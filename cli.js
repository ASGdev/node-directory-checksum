const commandLineArgs = require('command-line-args')
const path = require('path')
const fs = require('fs')
const os = require('os')
const checksum = require('checksum')
const readdirp = require('readdirp')
const util = require('util');
const stream = require('stream');

const streamFinished = util.promisify(stream.finished)

const OUTPUT_FILE_DEFAULT_VALUE = "./sums.txt"

const optionDefinitions = [
	{ name: 'directory', alias: 'd', defaultOption: true },
	{ name: 'algorithm', alias: 'a', type: String, defaultValue: "sha256" },
	{ name: 'output', alias: 'o', type: Boolean, defaultValue: false },
	{ name: 'file', alias: 'f', type: String, defaultValue: OUTPUT_FILE_DEFAULT_VALUE },
	{ name: 'type', alias: 't', type: String, defaultValue: "tab" }
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
		for await (const entry of readdirp(options.directory)) {
			let hash = null
			try {
				hash = await computeHashPromise(entry.fullPath, options.algorithm)
			} catch(e){
				console.log(e)
			}

			hashes.push({file: entry.path, hash: hash})
		}

	}

	if(options.output){
		try {
			const fname = options.file || OUTPUT_FILE_DEFAULT_VALUE
			const file = fs.createWriteStream(fname, {encoding: 'utf8'})
	
			switch (options.type) {
				case 'tab':
					for(couple of hashes){
						file.write(couple.file + "\t" + couple.hash + "\r\n")
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
			console.log("Error writing file")
			console.log(e)
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

