//Server/controllers/userController.js

const ApiError = require("../error/ApiError");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User, Basket } = require("../models/models");

const generateJwt = (id, email, role) => {
  return jwt.sign({ id, email, role }, process.env.SECRET_KEY, {
    expiresIn: "24h",
  });
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
    const token = generateJwt(user.id, user.email, user.role);

    return res.json({ token });
  }
  async login(req, res, next) {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return next(ApiError.internal("Пользователь не найден"));
    }
    let comparePassword = bcrypt.compareSync(password, user.password);
    if (!comparePassword) {
      return next(ApiError.internal("Указанный пароль не верный"));
    }
    const token = generateJwt(user.id, user.email, user.role);
    return res.json({ token });
  }
  async check(req, res, next) {
    const token = generateJwt(req.user.id, req.user.email, req.user.role);
    return res.json({ token });
  }

  async updateProfile(req, res, next) {
    try {
        const { firstName, lastName, phone } = req.body;
        const userId = req.user.id; // Получаем ID текущего пользователя из токена

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: "Пользователь не найден" });
        }

        // Обновляем данные
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
      const userId = req.user.id; // Получаем ID текущего пользователя из токена
      const user = await User.findByPk(userId);

      if (!user) {
          return res.status(404).json({ message: "Пользователь не найден" });
      }

      res.json({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          email: user.email,
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

      // Проверяем текущий пароль
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
          return res.status(400).json({ message: "Текущий пароль неверен" });
      }

      // Хешируем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({ message: "Пароль успешно обновлен" });
  } catch (error) {
      console.error(error);
      next(error);
  }
}



}

module.exports = new UserController();
