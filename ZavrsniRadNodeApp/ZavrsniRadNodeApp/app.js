var d2gsi = require('dota2-gsi');
var server = new d2gsi();
const net = require('net');
const fs1 = require('fs');
const port = 80;
var host;
var isConnected = false;
var rawRequest;
var Pr = require('promise');
var readFile = Pr.denodeify(require('fs').readFile);
const { SerialPort, ReadyParser } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
var arduino_com_port = 'comX';
const VDF = require('@node-steam/vdf');
const Registry = require('winreg');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const REG = 'SteamPath'
const WINSTEAMLIB = path.join('steamapps', 'libraryfolders.vdf');
const GSIFILENAME = 'gamestate_integration_dota2-gsi.cfg'
const HOMEDIR = (process.env.SNAP) ? path.join('/home', process.env.USER) : os.homedir()
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

function findArduino() {
    SerialPort.list().then(com_ports => {
        com_ports.forEach(function (port) {
            var Test = new SerialPort({ path: port.path, baudRate: 115200 });
            var readyparser = Test.pipe(new ReadyParser({ delimiter: 'Arduino' }));

            Test.on('open', function () {
                console.log('Trying serial port: ', port.path);
            });

            readyparser.on('ready', function () {
                console.log('Arduino found at ', Test.path);
                arduino_com_port = Test.path;
                return;
            });

            setTimeout(function () {
                Test.close(function () {
                    console.log(port.path, ' closed.');
                });
            }, 4000);

        });
    });
}

function begin(again) {
    var Wifi;
    var ArduinoPort = new SerialPort({ path: arduino_com_port, autoOpen: false, baudRate: 115200 });
    const lineStream = ArduinoPort.pipe(new ReadlineParser({ Delimiter: '\r\n' }));
    ArduinoPort.open(function () {
        console.log('Starting communication with Arduino on ' + arduino_com_port + '.\nData rate: ' + ArduinoPort.baudRate);
        ArduinoPort.on('close', PortClosed);
        ArduinoPort.on('error', showError);
        const promise = new Promise(resolve => {
            lineStream.on('data', (data) => {
                Wifi = data.trim();
                resolve(data);
            });
        });
        promise.then(() => {
            CheckConnection();
        });


    });
    function ReadAfterNoResponse() {
        return new Promise((resolve, reject) => {
            readline.question('Try entering ssid and password again? (y/n):  ', function (yesno) {
                if (yesno == 'y' || yesno == 'Y') {
                    again = true;
                    resolve(CheckConnection());
                }
                else if (yesno == 'n' || yesno == 'N')
                    resolve(process.exit());
                else if (yesno != 'y' || yesno != 'Y' || yesno != 'n' || yesno != 'N') {
                    reject("Wrong input.");
                    ReadAfterNoResponse()
                        .catch((error) => console.log('error', error));
                }
            });
        })
            .catch((error) => console.log('error', error));
    }
    function PortClosed() {
        console.log('Serial port closed.');

    }
    function showError(error) {
        console.log('Serial port error: ' + error);
    }
    function sendToSerial(data) {
        ArduinoPort.write(data);
    }

    function CheckConnection() {
        if (Wifi == "WifiOK" && again == false) {
            console.log("Waiting for new IP address...");
            return new Promise(resolve => {
                lineStream.on('data', (data) => {
                    if (ValidateIPaddress(data.trim()) == true) {
                        if (socket.connecting == false) {
                            console.log("New IP address: " + data.trim())
                            host = data.trim();
                            fs1.writeFileSync("./saved_ip.json", JSON.stringify(data.trim()));
                            resolve(data, console.log("Retrying connection..."),
                                socket.connect(port, host), setTimeout(function () { ArduinoPort.close(); }, 3000));
                        }
                    }
                });
            });
        }

        else if (Wifi == "WifiNotOK" || again == true) {
            again = false;
            return new Promise(resolve => {
                readline.question('Input new WiFi SSID: ', function (ssid) {
                    resolve(sendToSerial(ssid + '\r'));
                    return new Promise(resolve => {
                        readline.question('Input new WiFi password: ', function (pass) {
                            resolve(sendToSerial(pass + '\n'), console.log("WiFi info sending to Arduino..."));
                            return new Promise((resolve, reject) => {
                                console.log("Waiting for new IP address from Arduino...");
                                lineStream.on('data', (data) => {
                                    if (ValidateIPaddress(data.trim()) == true) {
                                        if (socket.connecting == false) {
                                            console.log("New IP address: " + data.trim());
                                            host = data.trim();
                                            fs1.writeFileSync("./saved_ip.json", JSON.stringify(data.trim()));
                                            resolve(data, console.log("Retrying connection..."),
                                                socket.connect(port, host), setTimeout(function () { ArduinoPort.close(); }, 3000));
                                        }
                                    }
                                });
                                setTimeout(() => {
                                    if (isConnected == false && socket.connecting == false) {
                                        reject("Waiting for IP address timed out.");
                                        console.log("If the LED strip has a red loading bar, arduino is not connected to WiFi.\n If it has a purple loading bar, the WiFi is connected, but your PC is not on the same network.");
                                        ReadAfterNoResponse();
                                    }
                                }, 18000);
                            })
                                .catch((error) => console.log('error', error));
                        });
                    })
                });
            });
        }
    }
}



function saveConfig() {
    let cfg = VDF.stringify({
        'dota2-gsi Configuration': {
            'uri': "http://localhost:3000/",
            'timeout': 5,
            'buffer': 0.1,
            'throttle': 0.1,
            'heartbeat': "30.0",
            'data':
            {
                'buildings': 1,
                'provider': 1,
                'map': 1,
                'player': 1,
                'hero': 1,
                'abilities': 1,
                'items': 1,
                'draft': 1,
                'wearables': 1
            },
            'auth':
            {
                'token': "hello1234"
            }
        }
    })
    getDotaPath(function (pth) {
        fs.exists(path.join(pth, GSIFILENAME), function (exists) {
            if (!exists) {
                fs.writeFile(path.join(pth, GSIFILENAME), cfg)
                console.log("Config saved to dota2 installation folder.");
            }
            else
                console.log("Config file already exists in dota2 folder.");
        });
    })
}
function getDotaPath(cb) {
    getLibraryFoldersVDFPath(function (vdfPath) {
        getLibraryFolders(vdfPath, function (libraries) {
            libraries.push(path.join(path.dirname(vdfPath), 'common'))
            libraries.forEach(function (pth, index) {
                let cfgPath = path.join(pth, 'dota 2 beta', 'game', 'dota', 'cfg', 'gamestate_integration')
                fs.pathExists(cfgPath, function (err, exists) {
                    if (!err && exists) {
                        cb(cfgPath)
                    }
                })
            })
        })
    })
}
function getLibraryFoldersVDFPath(cb = function () { }) {
    if (os.platform() === 'win32') {
        let regKey = new Registry({
            hive: Registry.HKCU,
            key: '\\Software\\Valve\\Steam'
        })
        regKey.values(function (err, items) {
            let r = false
            if (err) {
                console.log('ERROR: ' + err)
            }
            else {
                for (var i = 0; i < items.length && !r; i++) {
                    if (items[i].name === REG) {
                        r = path.join(items[i].value, WINSTEAMLIB)
                    }
                }
            }
            cb(r)
        })
    }
    else {
        let vdfpath
        if (os.platform() === 'darwin') {
            vdfpath = path.join(HOMEDIR, 'Library/Application Support/Steam/steamapps/libraryfolders.vdf')
        }
        else {
            vdfpath = path.join(HOMEDIR, '.local/share/Steam/steamapps/libraryfolders.vdf')
        }
        cb(vdfpath)
        return vdfpath
    }
}
function getLibraryFolders(vdfPath, cb) {
    let folders = []
    try {
        fs.readFile(vdfPath, { encoding: 'utf8' }, function (err, data) {
            if (!err) {
                let vdfdata = VDF.parse(data)
                if ('LibraryFolders' in vdfdata) {
                    vdfdata = vdfdata['LibraryFolders']
                    let key
                    for (key in vdfdata) {
                        if (!isNaN(key)) {
                            folders.push(path.join(vdfdata[key].path, 'steamapps', 'common'))
                        }
                    }
                }
            }
            cb(folders)
        })
    }
    catch (err) {
        cb(folders)
    }
}
function exitHandler(options, exitCode) {
    if (options.cleanup) socket.destroy();
}
function ValidateIPaddress(ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return (true)
    }
    return (false)
}
function IfFound(again) {
    if (arduino_com_port != 'comX') {
        begin(again);
    }
    else {
        console.log("Arduino board not found, please restart the application with arduino plugged in USB port.")
        const keypress = async () => {
            process.stdin.setRawMode(true)
            return new Promise(resolve => process.stdin.once('data', () => {
                process.stdin.setRawMode(false)
                resolve()
            }))
        };
        (async () => {

            console.log('Press any key to continue...')
            await keypress()
        })().then(process.exit)
    }
}

function readJsonFile(jsonName) {
    return readFile(jsonName, 'utf8').then((response) => {
        return JSON.parse(response);
    });
}


exports.saveConfig = saveConfig
saveConfig();
const socket = new net.Socket();
fs1.exists('./saved_ip.json', function (exists) {
    if (exists) {
        readJsonFile('./saved_ip.json')
            .then((json) => {
                host = json;
                console.log("Trying to connect to board with previous configuration...");
                socket.connect(port, host);
            })
            .catch();
    }
    else {
        var again = false;
        console.log("Previous configuration not found, starting search for arduino on serial ports...");
        findArduino();
        setTimeout(function () { IfFound(again); }, 7000);
    }
});


socket.on('connect', () => {
     console.log(`Connected to Arduino board`);
     console.log(`On local port: ${socket.localPort}\n`);
     console.log(`Ready for connection with dota2.`);
     isConnected = true;

});
socket.on('close', () => {
    isConnected = false;
    console.log(`Cannot connect to board.`);
    console.log("If the LED strip has a red loading bar, arduino is not connected to WiFi.\n If it has a purple loading bar, the WiFi is connected, but your PC is not on the same network.");
    read();
    function read() {
        return new Promise((resolve, reject) => {
            readline.question('Try entering ssid and password again? (y/n):  ', function (yesno) {
                if (yesno == 'y' || yesno == 'Y') {
                    if (arduino_com_port != 'comX') {
                        var again = true;
                        resolve(IfFound(again));
                    }
                    else {
                        findArduino();
                        var again = true;
                        setTimeout(function () { IfFound(again); }, 7000);
                    }
                }
                else if (yesno == 'n' || yesno == 'N')
                    resolve(process.exit());
                else if (yesno != 'y' || yesno != 'Y' || yesno != 'n' || yesno != 'N') {
                    reject("Wrong input.");
                    read()
                        .catch((error) => console.log('error', error));
                }
            });
        })
            .catch((error) => console.log('error', error));
    }
});

server.events.on('newclient', function (client) {
    client.on('player:activity', function (activity) {
        if (activity == 'playing') console.log("Game started!");
        console.log(activity);
    });

    client.on('hero:health_percent', function (alive) {
        rawRequest = client.gamestate.hero.health_percent.toString();
        socket.write(rawRequest + "H \r\n");
    });

    client.on('hero:mana_percent', function (alive) {
        rawRequest = client.gamestate.hero.mana_percent.toString();
        socket.write(rawRequest + "M \r\n");
    });
    client.on('hero:alive', function (alive) {
        if (alive == true) {
            rawRequest = "1";
            socket.write(rawRequest + "D \r\n");
            rawRequest = client.gamestate.hero.health_percent.toString();
            socket.write(rawRequest + "H \r\n");
            rawRequest = client.gamestate.hero.mana_percent.toString();
            socket.write(rawRequest + "M \r\n");
        }
        else if (alive == false) {
            rawRequest = "0";
            socket.write(rawRequest + "D \r\n");
        }
    });

    client.on('hero:respawn_seconds', function (respawn_seconds) {
        rawRequest = respawn_seconds.toString();
        socket.write(rawRequest + "S \r\n");
    });


    if (client != 0) {
        if (client.gamestate.hero && client.gamestate.hero.health_percent && client.gamestate.hero.mana_percent && client.gamestate.hero.alive) {
            if (client.gamestate.hero.alive == true) {
                rawRequest = "1";
                socket.write(rawRequest + "D \r\n");
                rawRequest = client.gamestate.hero.health_percent.toString();
                socket.write(rawRequest + "H \r\n");
                rawRequest = client.gamestate.hero.mana_percent.toString();
                socket.write(rawRequest + "M \r\n");
            }
            if (client.gamestate.hero.alive == false) {
                rawRequest = "0";
                socket.write(rawRequest + "D \r\n");

            }
        }
    }

    setInterval(function () {
        if (client != 0) {
            if (!client.gamestate.hero) {
                    socket.write("0" + "H \r\n");
                    socket.write("0" + "M \r\n");
                    socket.write("1" + "D \r\n");
                    socket.write("0" + "S \r\n");
            }
        }
    }, 10 * 1000);

});

process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('uncaughtException', function (exception) {
    console.log(exception);
});


