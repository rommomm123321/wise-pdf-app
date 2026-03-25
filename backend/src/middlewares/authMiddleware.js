const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_redlines';

/**
 * Middleware для защиты API роутов.
 * Проверяет наличие и валидность JWT токена в куки, заголовке Authorization или в query параметре token.
 */
const authMiddleware = (req, res, next) => {
  let token = req.cookies?.token;
  
  // 1. Пытаемся получить из куки или заголовка
  const authHeader = req.headers.authorization;
  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // 2. Если нет в заголовке/куки, проверяем query параметр (для прямых ссылок на скачивание)
  else if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'No token provided' });
  }

  try {
    // Расшифровываем токен
    const decoded = jwt.verify(token, JWT_SECRET);
    // Кладем данные пользователя в объект запроса
    req.user = decoded;
    next(); // Пропускаем запрос дальше
  } catch (error) {
    return res.status(403).json({ status: 'error', message: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;