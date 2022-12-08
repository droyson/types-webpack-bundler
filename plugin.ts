import * as webpack from 'webpack'

class DeclarationBundlerPlugin {
	out: string;
	moduleName: string;
	mode: string;
	excludedReferences: string[];

	constructor(options: any = {}) {
		this.out = options.out ? options.out : './build/index.d.ts';
		this.excludedReferences = options.excludedReferences ? options.excludedReferences : undefined;

		if (!options.moduleName) {
			throw new Error('please set a moduleName if you use mode:internal. new DeclarationBundlerPlugin({mode:\'internal\',moduleName:...})');
		}
		this.moduleName = options.moduleName;
	}

	apply(compiler: webpack.Compiler) {
		const { webpack } = compiler

		const { Compilation } = webpack

		const { RawSource } = webpack.sources
 
		compiler.hooks.thisCompilation.tap('DeclarationBundlerPlugin', (compilation: webpack.Compilation) => {
			compilation.hooks.processAssets.tap({
				name: 'DeclarationBundlerPlugin',
				stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
			}, (assets) => {
				//collect all generated declaration files
				//and remove them from the assets that will be emitted
				const declarationFiles: Object = {}
				for (const filename in assets) {
					if (filename.search(/\.d\.ts$/) !== -1) {
						declarationFiles[filename] = assets[filename]
						compilation.deleteAsset(filename)
					}
				}
				//combine them into one declaration file
				const combinedDeclaration = this.generateCombinedDeclaration(declarationFiles)

				//and insert that back into the assets
				compilation.emitAsset(this.out, new RawSource(combinedDeclaration))
			})
		});
	}

	private generateCombinedDeclaration(declarationFiles: Object): string {
		var declarations = '';
		for (var fileName in declarationFiles) {
			var declarationFile = declarationFiles[fileName];
			// The lines of the files now come as a Function inside declaration file.
			var data = declarationFile.source();
			var lines = data.split("\n");
			var i = lines.length;


			while (i--) {
				var line = lines[i];

				//exclude empty lines
				var excludeLine: boolean = line == "";

				//exclude export statements
				excludeLine = excludeLine || line.indexOf("export =") !== -1 ||
				    line.search(/^\s*export type \{/) !== -1 ||
				    line.search(/^\s*export \{/) !== -1 ||
				    line.search(/^\s*export \*/) !== -1;

				//exclude import statements
				excludeLine = excludeLine ||
				    (/import ([a-z0-9A-Z_-]+) = require\(/).test(line) ||
				    (/import ([a-z0-9A-Z_-]+)/).test(line) ||
				    (/import [\"\']/).test(line) ||
				    (/import \{/).test(line) ||
				    (/import \*/).test(line);

				//if defined, check for excluded references
				if (!excludeLine && this.excludedReferences && line.indexOf("<reference") !== -1) {
					excludeLine = this.excludedReferences.some(reference => line.indexOf(reference) !== -1);
				}


				if (excludeLine) {
					lines.splice(i, 1);
				}
				else {
					if (line.indexOf("declare ") !== -1) {
						lines[i] = line.replace("declare ", "");
					}
					//add tab
					lines[i] = "\t" + lines[i];
				}
			}
			declarations += lines.join("\n") + "\n\n";
		}

		var output = "declare module " + this.moduleName + "\n{\n" + declarations + "}";
		return output;
	}

}

export = DeclarationBundlerPlugin;
