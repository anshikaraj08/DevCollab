import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true, select: false },
    },
    { timestamps: true }
);


userSchema.methods.isValidPassword = function (plain) {
    return bcrypt.compare(plain, this.password);
};

// Short-lived token, sent in the Authorization header
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            id: this._id,
            email: this.email
        },
        process.env.JWT_SECRET,
        {
        expiresIn: "15m",
        }
    );
};  


// Long-lived token, stored in an HTTP-only cookie, used only to get new access tokens
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({ id: this._id },
        process.env.JWT_REFRESH_SECRET, {
        expiresIn: "7d",
    });
};

export default mongoose.model("User", userSchema);

