const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
    if (req.method === "OPTIONS") {
        return next();
    }
    try {
        const authorizationHeader = req.headers.authorization;

        if (!authorizationHeader) {
            req.user = null; 
            return next(); 
        }

        const token = authorizationHeader.split(' ')[1]; 

        if (!token) {
            req.user = null;
            return next(); 
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded;
        return next();

    } catch (error) {
        req.user = null; 
        return next();
    }
};
