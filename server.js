var fs = require('fs');
var tar = require('tar-fs');
var os = require('os');
var ifaces = os.networkInterfaces();

var express = require('express');
var expr = express();
var serveIndex = require('serve-index');
var httpr = require('http').Server(expr);
var http = require('http');
var ipgeoblock = require("node-ipgeoblock");

//var file_loader = require("./apps/townofsalem/js/file_loader.js");
var bigC = ["US", "CA",  "IN", "AU"];
var dangerC = ["RU", "CN", "HK", "KP"];
var arabC = ["EG", "TR", "SY", "LB", "JO", "SA", "IR", "IQ", "AE"];
var otherC = ["KR","CZ", "ID", "IT", "BR"];
var AllC = bigC.concat(dangerC).concat(arabC).concat(otherC);

expr.use(ipgeoblock({
    geolite2: "./GeoLite2-Country.mmdb",
    blockedCountries: AllC
}));

expr.get('/', function (req, res) {
	printReq(req);
	res.sendStatus(403); // forbidden
});
expr.get('/tar', function (req, res) {
	printReq(req)
	res.download(__dirname + '/sticker package.tar');
});
expr.get('/apk', function (req, res) {
	printReq(req)
	res.download(__dirname + '/CalamityStickersApp.apk');
});
/*expr.get(/^(.+)$/, function (req, res) {
	printReq(req)
	res.sendFile(__dirname + '/packs' + req.params[0]);
});*/
expr.use('/packs', express.static('packs'), function(req, res, next){
	printReq(req);
	next();
},serveIndex('packs', {'icons': false , 'template': "./template.html"}));

function printReq(req) {
	let d = new Date();
	let time = d.getHours() + ":" + d.getMinutes();
	let cISO = req.location.country.isoCode;
	
	let prefix = "\u001b[10D\u001b[30;1m(\u001b[37m"+ time +"\u001b[30;1m " + req.hostname + ")\u001b[0m\t";
	let who = "\u001b[35;1m" + req.ip.toString().split(":")[3] + "\u001b[30;1m["+ cISO +"]\u001b[0m\t";
	let requestString = "is requesting '" + req.path + "'";
	
	console.log(prefix + who + requestString);
	process.stdout.write("Server> ");
}

const port = 80;

var json = {
	"android_play_store_link": "",
	"ios_app_store_link": "",
	"sticker_packs": []
}

var server = httpr.listen(port, function () {
	console.log("\t\x1b[32;1mOnline\x1b[0m");
	console.log("\t\x1b[36;1m" + getIP() + "\x1b[0m");
	console.log('\tis listening on \x1b[33;1m' + port + "\x1b[0m");
	console.log("\t\x1b[36;1m" + server.address().address + "\x1b[0m");

	if (!fs.existsSync("./packs/info.json")) {
		fileScan("./packs");
		writeJsonFile();
	}

	process.stdout.write("\nServer> ");
});

var stdin = process.openStdin();

stdin.addListener("data", function (d) {
	ds = d.toString().trim();
	// note:  d is an object, and when converted to a string it will
	// end with a linefeed.  so we (rather crudely) account for that  
	// with toString() and then trim() 
	if (ds == "help" || ds == "?") {
		console.log("Commands:")
		console.log("\thelp / ? \t- this info");
		console.log("\tjson / scan \t- scan & print all the file and gen a javascript json obj");
		console.log("\tzip / tar / compress \t- compress everyting into a tar that will be sent to the app");
		console.log("\tmake / build / rebuild \t- do a scan, write the JSON file to the storage and compress everything");
		console.log("\tclose / exit / quit \t- close server and quit");
	} else
	if (ds == "json" || ds == "scan") {
		resetJson();
		fileScan("./packs");
	} else
	if (ds == "build" || ds == "rebuild" || ds == "make") {
		resetJson();
		fileScan("./packs");
		writeJsonFile();
		compress();
	} else
	if (ds == "zip" || ds == "tar" || ds == "compress") {
		compress();
	} else
	if (ds == "close" || ds == "exit" || ds == "quit") {
		closeServer();
		process.exit()
	} else {
		console.log(ds + "\t- command not found");
		console.log("\u001b[30m A \u001b[31m B \u001b[32m C \u001b[33m D \u001b[0m")
		console.log("\u001b[34m E \u001b[35m F \u001b[36m G \u001b[37m H \u001b[0m")
		console.log("\u001b[30;1m A \u001b[31;1m B \u001b[32;1m C \u001b[33;1m D \u001b[0m")
		console.log("\u001b[34;1m E \u001b[35;1m F \u001b[36;1m G \u001b[37;1m H \u001b[0m")
	}
	process.stdout.write("Server> ");
});
/*require('electron').ipcRenderer.on('closeServer', function (event, data) {
    closeServer();
});*/

function closeServer() {
	httpr.close();
}

function getIP() {
	var address = "192.168.1.1";
	Object.keys(ifaces).forEach(function (ifname) {
		var alias = 0;

		ifaces[ifname].forEach(function (iface) {
			if ('IPv4' !== iface.family || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}
			if (alias >= 1) {
				// this single interface has multiple ipv4 addresses
				//console.log(ifname + ':' + alias, iface.address);
			} else {
				// this interface has only one ipv4 adress
				address = (address == "192.168.1.1") ? iface.address : address;
				//console.log(ifname, iface.address);
			}
			++alias;
		});
	});
	//console.log(address);
	return address;
}

function resetJson() {
	json = {
		"android_play_store_link": "",
		"ios_app_store_link": "",
		"sticker_packs": []
	};
}

function fileScan(location) {
	//var location = "./packs";
	var arr = [];
	// Loop through all the files in the temp directory
	var files = fs.readdirSync(location);

	files.forEach(function (file, index) {
		// Make one pass and make the file complete
		var fromPath = location + "/" + file;

		let stat = fs.statSync(fromPath)

		if (stat.isFile()) {
			console.log("\tfound file '%s'", file);
			if (file != "tray.png" && file != "favicon.ico")
				arr.push(file.toString());
		} else if (stat.isDirectory()) {
			console.log("found sticker pack '%s'", file);
			var pack = {
				"identifier": "",
				"name": "",
				"publisher": "",
				"tray_image_file": "tray.png",
				"publisher_email": "",
				"publisher_website": "",
				"privacy_policy_website": "",
				"license_agreement_website": "",
				"stickers": []
			};
			pack.identifier = file;
			let info = file.split("-");
			pack.name = info[0];
			pack.publisher = info[1];

			var stickerarr = [];
			stickerarr = fileScan(fromPath)
			//console.log(stickerarr)
			stickerarr.forEach(function (s) {
				let sticker = {
					"image_file": "",
					"emojis": []
				};
				sticker.image_file = s;
				pack.stickers.push(sticker);
			});

			json.sticker_packs.push(pack);
		}
	});
	return arr;
}

function writeJsonFile() {
	if (fs.existsSync("./packs/info.json")) {
		fs.unlinkSync('./packs/info.json');
	}
	fs.writeFileSync('./packs/info.json', JSON.stringify(json), 'utf-8');
	console.log('finished writing JSON file');
}

function compress() {
	fs.unlinkSync('sticker package.tar');
	tar.pack('./packs').pipe(fs.createWriteStream('sticker package.tar'));
	console.log("packing to a tarball...");
}