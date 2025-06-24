const ApiError = require("../error/ApiError");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { User, Basket } = require("../models/models");

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
    {
      expiresIn: "15m",
    }
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
    const { email, password, role, firstName, lastName, phone } = req.body;
    if (!email || !password) {
      return next(ApiError.badRequest("Некорректный маил или пароль"));
    }
    const candidate = await User.findOne({ where: { email } });
    if (candidate) {
      return next(
        ApiError.badRequest("Пользователь с таким маилом сушествует")
      );
    }
    const hashPassword = await bcrypt.hash(password, 5);
    const user = await User.create({
      email,
      role,
      password: hashPassword,
      firstName,
      lastName,
      phone,
    });
    const basket = await Basket.create({ userId: user.id });

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
  }

  async login(req, res, next) {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(ApiError.internal("Пользователь не найден"));
    }
    const comparePassword = bcrypt.compareSync(password, user.password);
    if (!comparePassword) {
      return next(ApiError.internal("Указанный пароль не верный"));
    }
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.role
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken });
  }

  async check(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: "Не авторизован" });
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
        return res.status(401).json({ message: "Не авторизован" });
      }

      const { firstName, lastName, phone } = req.body;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      user.firstName = firstName || user.firstName;
      user.lastName = lastName || user.lastName;
      user.phone = phone || user.phone;
      await user.save();

      res.json({ message: "Данные успешно обновлены", user });
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Не авторизован" });
      }

      const userId = req.user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({
         firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  email: user.email,
  hasPassword: !!user.password,
      });
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ message: "Пользователь не найден" });
      }

      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        user.password
      );
      if (!isPasswordValid) {
        return res.status(400).json({ message: "Текущий пароль неверен" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({ message: "Пароль успешно обновлен" });
    } catch (error) {
      console.error(error);
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const token = req.cookies.refreshToken;

      if (!token) {
        return res.status(401).json({ message: "Нет refresh токена" });
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
      return res.status(401).json({ message: "Невалидный refresh токен" });
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
      next(error);
    }
  }
}

module.exports = new UserController();
