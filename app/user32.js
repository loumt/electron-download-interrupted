const ffi = require('ffi')

module.exports = ffi.Library('user32', {
    'GetWindowLongPtrW': ['int', ['int', 'int']],
    'SetWindowLongPtrW': ['int', ['int', 'int', 'long']],
    'GetSystemMenu': ['int', ['int', 'bool']],
    'DestroyWindow': ['bool', ['int']]
});