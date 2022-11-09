const commandLineArgs = require('command-line-args')
const path = require('path')
const fs = require('fs')
const os = require('os')
const checksum = require('checksum')
const readdirp = require('readdirp')
const util = require('util')
const stream = require('stream')
const process = require('process')
const filenamify = require('filenamify')

const streamFinished = util.promisify(stream.finished)

const optionDefinitions = [
	{ name: 'directory', alias: 'd', defaultOption: true },
	{ name: 'algorithm', alias: 'a', type: String, defaultValue: "sha256" },
	{ name: 'output', alias: 'o', type: Boolean, defaultValue: false },
	{ name: 'file', alias: 'f', type: String },
	{ name: 'type', alias: 't', type: String, defaultValue: "tab" },
	{ name: 'extended', alias: 'e', type: Boolean, defaultValue: false }
]
const options = commandLineArgs(optionDefinitions);

(async () => {
	let hashes = []
	
	let fpath = options.directory

	if(!path.isAbsolute(fpath)){
		fpath = path.resolve(fpath)
	}
	
	const isDir = fs.lstatSync(fpath).isDirectory();
	

	if(isDir){
		for await (const entry of readdirp(options.directory, { alwaysStat: options.extended })) {
			let hash = null
			try {
				hash = await computeHashPromise(entry.fullPath, options.algorithm)
			} catch(e){
				console.log(e)
			}

			hashes.push({
				file: entry.path, 
				hash: hash, 
				size: (entry.stats) ? entry.stats.size : null 
			})
		}

	} else {
		console.log("Must provide directory")
		
		process.exit(-1)
	}

	if(options.file || options.output){
		try {
			const fname = options.file || filenamify(fpath + "-sums-" + Date.now())
 			const file = fs.createWriteStream(fname, {encoding: 'utf8'})
	
			switch (options.type) {
				case 'tab':
					for(couple of hashes){
						if (options.extended) {
							file.write(couple.hash + "\t" + ((couple.size) ? couple.size + "\t" : "") + couple.file + "\r\n")
						} else {
							file.write(couple.hash + "\t" + couple.file + "\r\n")
						}
					}
					file.end()
					break;
				case 'json':
					file.end(JSON.stringify(hashes))
					break;
				default:
					console.log("Output type not implemented");
					process.exit(-1)
			}
			
			await streamFinished(file)
			
			process.exit(0)
			
		} catch(e){
			console.log(e)
			
			console.log("!!! error writing file")
			

			process.exit(-1)
		}
	} else {
		console.log(hashes)
		
		process.exit(0)
	}
})();

function computeHashPromise(file, algorithm){
	return new Promise((resolve, reject) => {
		checksum.file(file, { algorithm }, function response(err, sum) {
			if (err) {
				reject(err)
			} else {
				resolve(sum)
			}
		})
	})
}

