const ApiError = require("../error/ApiError");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { User, Basket } = require("../models/models");
const { t, normLang } = require("../utils/translations");

const getLang = (req) =>
  normLang(req.body?.language || req.headers["x-lang"] || "est");

const generateTokens = (
  id,
  email,
  role,
  firstName = null,
  lastName = null,
  phone = null
) => {
  const accessToken = jwt.sign(
    { id, email, role, firstName, lastName, phone },
    process.env.SECRET_KEY,
    { expiresIn: "24h" }
  );

  const refreshToken = jwt.sign(
    { id, email, role, firstName, lastName, phone },
    process.env.REFRESH_SECRET_KEY,
    { expiresIn: "30d" }
  );

  return { accessToken, refreshToken };
};

class UserController {
  async registration(req, res, next) {
    try {
      const lang = getLang(req);
      const { email, password, firstName, lastName, phone } = req.body;

      if (!email || !password) {
        return next(ApiError.badRequest(t("auth_invalid_input", lang)));
      }

      const candidate = await User.findOne({ where: { email } });
      if (candidate) {
        return next(ApiError.badRequest(t("auth_user_exists", lang)));
      }

      const hashPassword = await bcrypt.hash(password, 5);
      const user = await User.create({
        email,
        role: "USER",
        password: hashPassword,
        firstName,
        lastName,
        phone,
      });

      await Basket.create({ userId: user.id });

      const { accessToken, refreshToken } = generateTokens(
        user.id,
        user.email,
        user.role,
        user.firstName,
        user.lastName,
        user.phone
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken });
    } catch (error) {
      console.error("Registration error:", error);
      return next(error);
    }
  }

  async login(req, res, next) {
    try {
      const lang = getLang(req);
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.internal(t("auth_invalid_credentials", lang)));
      }

      const comparePassword = bcrypt.compareSync(password, user.password);
      if (!comparePassword) {
        return next(ApiError.internal(t("auth_invalid_credentials", lang)));
      }

      const { accessToken, refreshToken } = generateTokens(
        user.id,
        user.email,
        user.role,
        user.firstName,
        user.lastName,
        user.phone
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken });
    } catch (error) {
      console.error("Login error:", error);
      return next(error);
    }
  }

  async check(req, res) {
    if (!req.user) {
      // системное — EN
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { accessToken } = generateTokens(
      req.user.id,
      req.user.email,
      req.user.role,
      req.user.firstName,
      req.user.lastName,
      req.user.phone
    );

    return res.json({ accessToken });
  }

  async updateProfile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { firstName, lastName, phone } = req.body;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.phone = phone || user.phone;
      await user.save();

      return res.json({ message: "Profile updated successfully", user });
    } catch (error) {
      console.error("Update profile error:", error);
      return next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      return res.json({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        hasPassword: !!user.password,
      });
    } catch (error) {
      console.error("Get profile error:", error);
      return next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      return res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Change password error:", error);
      return next(error);
    }
  }

  async refresh(req, res) {
    try {
      const token = req.cookies.refreshToken;

      if (!token) {
        return res.status(401).json({ message: "Refresh token not found" });
      }

      const userData = jwt.verify(token, process.env.REFRESH_SECRET_KEY);

      const { accessToken, refreshToken } = generateTokens(
        userData.id,
        userData.email,
        userData.role,
        userData.firstName,
        userData.lastName,
        userData.phone
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken });
    } catch (error) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
  }

  async googleLogin(req, res, next) {
    try {
      const { token } = req.body;

      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const { email, given_name, family_name, sub } = payload;

      let user = await User.findOne({ where: { email } });

      if (!user) {
        user = await User.create({
          email,
          role: "USER",
          firstName: given_name,
          lastName: family_name,
          provider: "google",
          providerId: sub,
        });

        await Basket.create({ userId: user.id });
      }

      const { accessToken, refreshToken } = generateTokens(
        user.id,
        user.email,
        user.role,
        user.firstName,
        user.lastName,
        user.phone
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken });
    } catch (error) {
      console.error("Google login error:", error);
      return next(error);
    }
  }
}

module.exports = new UserController();
