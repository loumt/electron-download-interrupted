const ffi = require('ffi')

//HWND   => int

module.exports = ffi.Library('Shell32', {
    'ShellExecuteW':
        [
            'int32', ['int32','string','string','string','string', 'int32']
        ],
    'ShellExecuteA':
        [
            'int32', ['int32','string','string','string','string', 'int32']
        ],
});