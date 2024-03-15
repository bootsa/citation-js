/* eslint-env mocha */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
require("../src/index.js");
const { plugins } = require("@citation-js/core");
const config = plugins.config.get("@bibtex");

import inputData from "./input.json";
import outputData from "./output.json";

function getInput(name, type) {
	const ext = type === "@bibtxt/text" ? ".txt" : ".bib";
	const file = path.join(__dirname, "input", name + ext);
	return fs.readFileSync(file, "utf8");
}

describe("input", function () {
	for (const type in inputData) {
		describe(type, function () {
			it("is registered", function () {
				assert(plugins.input.has(type));
			});
			for (const name of Object.keys(inputData[type])) {
				let [input, expected] = inputData[type][name];
				if (input === null) {
					input = getInput(name.slice(5), type);
				}
				describe(name, function () {
					it("parses type", function () {
						assert.strictEqual(plugins.input.type(input), type);
					});
					it("parses data", function () {
						assert.deepStrictEqual(
							plugins.input.chain(input, {
								generateGraph: false,
							}),
							expected,
						);
					});
				});
			}
		});
	}

	describe("sentenceCase", function () {
		afterEach(function () {
			config.parse.sentenceCase = "never";
		});
		it("is applied correctly", function () {
			config.parse.sentenceCase = "always";
			assert.deepStrictEqual(
				plugins.input.chain(
					`@book{a,
          title = "lowercase Lowercase: lowercase {Uppercase} UpperCASE UPPERCASE",
          language = "French"
        }`,
					{
						generateGraph: false,
					},
				),
				[
					{
						type: "book",
						id: "a",
						"citation-key": "a",
						title: "lowercase lowercase: lowercase Uppercase UpperCASE UPPERCASE",
						language: "French",
					},
				],
			);
		});
		it("protects case", function () {
			config.parse.sentenceCase = "always";
			assert.deepStrictEqual(
				plugins.input.chain(
					`@book{a,
          title = "{lowercase}",
          language = "French"
        }`,
					{
						generateGraph: false,
					},
				),
				[
					{
						type: "book",
						id: "a",
						"citation-key": "a",
						title: '<span class="nocase">lowercase</span>',
						language: "French",
					},
				],
			);
		});
		it("can check for English language", function () {
			config.parse.sentenceCase = "english";
			assert.deepStrictEqual(
				plugins.input.chain(
					`@string{title = "Lowercase Lowercase"}
        @book{a, title = title, language = "English and en-US" }
        @book{b, title = title, language = "English and French" }
        @book{c, title = title, language = "French" }`,
					{
						generateGraph: false,
					},
				),
				[
					{
						type: "book",
						id: "a",
						"citation-key": "a",
						title: "Lowercase lowercase",
						language: ["English", "en-US"],
					},
					{
						type: "book",
						id: "b",
						"citation-key": "b",
						title: "Lowercase Lowercase",
						language: ["English", "French"],
					},
					{
						type: "book",
						id: "c",
						"citation-key": "c",
						title: "Lowercase Lowercase",
						language: "French",
					},
				],
			);
		});
	});

	describe("errors", function () {
		it("for mismatched begin/end", function () {
			assert.throws(
				() =>
					plugins.input.chain(`@book{a,
          title = "\\begin{bf}bold\\begin{it}both\\end{bf}italic\\end{it}"
        }`),
				{
					name: "SyntaxError",
					// TODO: replace with the following when Node 8 is dropped
					// name: 'SyntaxError',
					// message: /environment started with "it", ended with "bf"/
				},
			);
		});
		describe("in strict mode", function () {
			before(function () {
				config.parse.strict = true;
			});
			after(function () {
				config.parse.strict = false;
			});
			it("for invalid entries", function () {
				assert.throws(
					() =>
						plugins.input.chain(`@book{a,
            title = "foo",
            author = "foo",
            publisher = "foo",
            year = 2020
          }
          @foo{b, }
          @book{c, }`),
					{
						name: "RangeError",
						message: `Invalid entries:
  - b has invalid type: "foo"
  - c has missing fields: author, title, year/date`,
					},
				);
			});
			it("for invalid bibtex entries", function () {
				assert.throws(
					() =>
						plugins.input.chain(
							`@book{a,
            title = "foo",
            author = "foo",
            publisher = "foo",
            year = 2020
          }
          @foo{b, }
          @book{c, }`,
							{ forceType: "@bibtex/text" },
						),
					{
						name: "RangeError",
						message: `Invalid entries:
  - b has invalid type: "foo"
  - c has missing fields: author/editor, title, publisher, year`,
					},
				);
			});
			it("not for valid entries", function () {
				assert.doesNotThrow(() =>
					plugins.input.chain(
						`@book{a,
          title = "foo",
          author = "foo",
          publisher = "foo",
          year = 2020
        }`,
						{ forceType: "@bibtex/text" },
					),
				);
			});
		});
	});
});

function getExpectedOutput(name, type) {
	const ext = type === "bibtxt" ? ".txt" : ".bib";
	const file = path.join(__dirname, "output", name + ext);
	return fs.readFileSync(file, "utf8");
}

function processOutput(output) {
	return typeof output === "string" ? output.trim() : output;
}

describe("output", function () {
	it("errors for invalid format dicts", function () {
		assert.throws(() => plugins.output.format("biblatex", [], { format: "latex" }), {
			name: "RangeError",
			message: 'Output dictionary "latex" not available',
		});
	});

	for (const type in outputData) {
		describe(type, function () {
			it("is registered", function () {
				assert(plugins.output.has(type));
			});

			for (const name in outputData[type]) {
				let [input, expected, ...opts] = outputData[type][name];
				if (!expected) {
					expected = getExpectedOutput(name, type);
				}

				it(`with ${name} works`, function () {
					const actual = plugins.output.format(type, input, ...opts);
					assert.deepStrictEqual(processOutput(actual), processOutput(expected));
				});
			}
		});
	}

	describe("asciiOnly", function () {
		afterEach(function () {
			config.format.asciiOnly = true;
		});

		// See https://github.com/citation-js/citation-js/issues/177
		it("keeps cyrillic characters", function () {
			const input = [
				{
					id: "antonenko1997",
					ISBN: "966-7219-00-3",
					type: "book",
					title: "Як ми говоримо",
					author: [{ given: "Б.Д.", family: "Антоненко-Давидович" }],
					issued: { "date-parts": [[1997]] },
					edition: "4",
					publisher: "Українська книга",
					"citation-key": "antonenko1997",
					"publisher-place": "Київ",
				},
			];

			config.format.asciiOnly = false;
			const actual = plugins.output.format("bibtex", input);
			const expected = `@book{antonenko1997,
\taddress = {Київ},
\tauthor = {Антоненко-Давидович, Б.Д.},
\tedition = {4},
\tisbn = {966-7219-00-3},
\tyear = {1997},
\tpublisher = {Українська книга},
\ttitle = {Як ми говоримо},
}\n\n`;
			assert.deepStrictEqual(actual, expected);
		});

		it("removes cyrillic characters", function () {
			const input = [
				{
					id: "antonenko1997",
					ISBN: "966-7219-00-3",
					type: "book",
					title: "Як ми говоримо",
					author: [{ given: "Б.Д.", family: "Антоненко-Давидович" }],
					issued: { "date-parts": [[1997]] },
					edition: "4",
					publisher: "Українська книга",
					"citation-key": "antonenko1997",
					"publisher-place": "Київ",
				},
			];

			const actual = plugins.output.format("bibtex", input);
			const expected = `@book{antonenko1997,
\taddress = {},
\tauthor = {-, ..},
\tedition = {4},
\tisbn = {966-7219-00-3},
\tyear = {1997},
\tpublisher = { },
\ttitle = {  },
}\n\n`;
			assert.deepStrictEqual(actual, expected);
		});
	});
});

describe("mapping", function () {
	for (const type of ["biblatex", "bibtex"]) {
		describe(type, function () {
			const csl = require(`./mapping/${type}-csl.json`);

			describe("input", function () {
				const file = fs.readFileSync(path.join(__dirname, `mapping/${type}-input.bib`), "utf8");
				const input = plugins.input.chainLink(file);
				for (let i = 0; i < input.length; i++) {
					it(input[i].label, function () {
						const actual = plugins.input.chain(input[i], {
							generateGraph: false,
							forceType: `@${type}/entry+object`,
						});
						assert.deepStrictEqual(actual, [csl[i]]);
					});
				}
			});

			describe("output", function () {
				const file = fs.readFileSync(path.join(__dirname, `mapping/${type}-output.bib`), "utf8");
				const expected = plugins.input.chainLink(file);
				for (let i = 0; i < csl.length; i++) {
					it(csl[i].id, function () {
						const actual = plugins.output.format(type, [csl[i]], { format: "object" });
						assert.deepStrictEqual(actual, [expected[i]]);
					});
				}
			});
		});
	}
});
