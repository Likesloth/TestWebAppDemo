const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const { Schema } = mongoose;

// regex ใช้ช่วง ASCII สำหรับ printable chars:
//  - ต้องมี lowercase อย่างน้อย 1 ตัว
//  - ต้องมี uppercase อย่างน้อย 1 ตัว
//  - ต้องมีตัวเลข อย่างน้อย 1 ตัว
//  - ต้องมี special character อย่างน้อย 1 ตัว (ASCII 33–47, 58–64, 91–96, 123–126)
//  - ความยาวขั้นต่ำ 8 ตัวอักษร และทุกตัวต้องอยู่ในช่วง printable ASCII (33–126)
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\x21-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E])[\x21-\x7E]{8,}$/;

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: v => passwordPattern.test(v),
      message:
        'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ (ASCII printable range).'
    }
  },
  createdAt: { type: Date, default: Date.now }
});

// hash password ก่อนบันทึก
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// method สำหรับตรวจสอบรหัสผ่าน
UserSchema.methods.verifyPassword = function(plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', UserSchema);
