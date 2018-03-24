const {BrowserWindow, app, ipcMain, dialog} = require('electron');

const path = require('path')
const url = require('url')
const config = require('./config');
const uuid = require('uuid').v4;
const user32 = require('./user32')
const shell32 = require('./shell32')
const request = require('request')
var util = require('util');
const fs = require('fs');
const imgDir = path.join(__dirname, 'othersource')
//用户自己提供下载目录
let downloadDir;
//应用内的下载目录
let appDownload = path.join(__dirname, config.download_dir);
let writeStream;

// let localPicBuffer = fs.readFileSync(path.join(__dirname,'./1.jpg'));
// let localPicStream = fs.createReadStream(path.join(__dirname,'./1.jpg'));

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {
    console.log('app start');
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800, show: false, height: 600, x: 50, y: 50, webPreferences: {
            nodeIntegration: true
        }
    })

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${path.join(__dirname, './index.html')}`)
    // Open the DevTools.
    // mainWindow.webContents.openDevTools()

    mainWindow.once('ready-to-show', () => {
        // let hwnd = mainWindow.getNativeWindowHandle() //获取窗口句柄。
        // user32.GetSystemMenu(hwnd.readUInt32LE(0), true); //禁用系统菜单.
        // for(let item in user32){
        //     console.log(item);
        // }
        initWebContentEvent();
        mainWindow.openDevTools();
        mainWindow.show()
    })

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        app.exit(0);
    })

    ipcMain.on('print-image', (e, arg) => {
        let webContent = null;
        let focusWindow = BrowserWindow.getFocusedWindow();
        if (typeof focusWindow === BrowserWindow) {
            webContent = focusWindow.webContents;
        }
        console.log('webContent:' + webContent);

        webLog('start to get window handle......')
        let hand = focusWindow.getNativeWindowHandle()
        //imagePrintPreview(hand);
        // webContents.getElementById('img-test')
        let imgPath = path.join(imgDir, uuid() + '.jpg');
        console.log(imgPath)
        console.log('print-image....' + hand);
        console.log('');
        console.log('------image url-------');
        let imageUrl = arg;
        console.log(imageUrl);

    });

    ipcMain.on('download-file', (evt, args) => {
        console.log('------download-file args-----');
        console.dir(args);
        downloadDir = args[0];
        let imageUrl = args[1];
        console.log('download file url : ' + imageUrl);
        evt.sender.send('tips', imageUrl);
        mainWindow.webContents.downloadURL(imageUrl);
    });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow()
    }
})


function imagePrintPreview(downloadFilePath, hand) {
    let hwnd = null;
    if (hand) {
        webLog('parse handle.....')
        hwnd = hand.readUInt32LE(0)
    }
    webLog('start to print preview.....')
    console.log(writeStream);
    console.log(typeof writeStream);
    // let rst = shell32.ShellExecuteA(hwnd, 'print', downloadFilePath, null, null, 0)
    let rst = shell32.ShellExecuteA(hwnd, 'print', downloadFilePath, null, null, 0)
    console.log('print preview result : ' + rst);
    BrowserWindow.getFocusedWindow().webContents.send('print-preview-result', [rst, downloadFilePath])
    clearFileTask(downloadFilePath)
}

function initWebContentEvent() {
    mainWindow.webContents.session.prependListener('will-download', (event, item, webContents) => {
        //设置文件存放位置
        let fileName = item.getFilename();
        let fileNameArr = fileName.split('.');
        let ext = fileNameArr[fileNameArr.length - 1];
        console.log('download file ext : ' + ext);
        let downloadFilePath = path.join(appDownload, uuid() + '.' + ext);
        console.log('downloadFilePath:' + downloadFilePath);

        webLog('electron will-download set downloadFlePath......' + downloadFilePath)

        item.setSavePath(downloadFilePath);

        item.on('updated', (event, state) => {
            webLog('electron will-download updated state:' + state)
            if (state === 'interrupted') {
                webLog('Download is interrupted but can be resumed')
                webLog(JSON.stringify(event))
                console.log('Download is interrupted but can be resumed')
            } else if (state === 'progressing') {
                if (item.isPaused()) {
                    console.log('Download is paused')
                } else {
                    console.log(`Received bytes: ${item.getReceivedBytes()}`)
                }
            }
        })
        item.once('done', (event, state) => {
            webLog('electron will-download done state:' + state)
            if (state === 'completed') {
                console.log('Download successfully');
                webLog('Download successfully')
                imagePrintPreview(downloadFilePath, getWindowHandle());
            } else {
                webLog(`Download failed: ${state}`)
                console.log(`Download failed: ${state}`)
            }
        })
    })
}

/**
 * 删除下载的文件
 * 文件一旦在打印预览中显示,那么如果删除了文件,预览中的图片会被清除
 * @param downloadFilePath
 */
function clearFileTask(downloadFilePath) {
    if (config.delFileNext) {
        setTimeout(() => {
            fs.unlinkSync(downloadFilePath);
        }, 2000)
    }
}


function webLog(msg) {
    BrowserWindow.getFocusedWindow().webContents.send('console-msg', msg)
}

function getWindowHandle() {
    webLog('start to get window handle......')
    return BrowserWindow.getFocusedWindow().getNativeWindowHandle();
}


function createFileStream(imageUrl) {

    let httpStream = request({
        method: 'GET',
        url: imageUrl
    });
// 由于不需要获取最终的文件，所以直接丢掉
    writeStream = fs.createWriteStream('/dev/null');

// 联接Readable和Writable
    httpStream.pipe(writeStream);

    let totalLength = 0;

// 当获取到第一个HTTP请求的响应获取
    httpStream.on('response', (response) => {
        console.log('response headers is: ', response.headers);
    });

    httpStream.on('data', (chunk) => {
        totalLength += chunk.length;
        console.log('recevied data size: ' + totalLength + 'KB');
    });

// 下载完成
    writeStream.on('close', () => {
        console.log('download finished');
    });

}