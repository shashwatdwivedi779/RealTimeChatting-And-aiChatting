const jwt = require('jsonwebtoken');

module.exports = async (req, res, next) => {
    const token = req.cookies.token;
        if(!token){
            req.isLoggedIn = false;
            return next();
        }
    try{
    const decoded = jwt.verify(token, "KAISE_HO_BHAII_SAB_THIK_HAI_NA");
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.email = decoded.email;
    req.isLoggedIn = true;
    } catch(err){
        req.isLoggedIn = false;
        console.log(err);
    }
    next();
}