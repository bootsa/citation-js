import { URL } from "node:url";
import wikidata from "./data/api/wikidata";
import doi from "./data/api/doi";

const configs = [
	{
		domain: /^(www\.)?wikidata\.org/,
		path: /^\/w\/api\.php/,
		response({ searchParams }) {
			const response = { entities: {} };
			const ids = searchParams.get("ids").split("|");
			for (const id of ids) {
				response.entities[id] = wikidata.entities[id] || {
					id,
					missing: "",
				};
			}
			return JSON.stringify(response);
		},
	},
	{
		domain: /^((www|dx)\.)?doi\.org/,
		path: /^\//,
		response({ pathname }) {
			const data = doi[pathname.slice(1).toUpperCase()];
			if (data) {
				return JSON.stringify(data[0]);
			} else {
				throw new Error("Server responded with status code 404");
			}
		},
	},
];

const mockResponse = function (request, opts) {
	const url = new URL(request);
	const { hostname, pathname: path } = url;
	const { response } = configs.find((config) => config.domain.test(hostname) && config.path.test(path));
	return response(url);
};

const fetchFile = (...args) => mockResponse(...args);
const fetchFileAsync = (...args) => Promise.resolve(mockResponse(...args));

module.exports = function (core) {
	if (process.env.TEST_MOCK_HTTP !== "false") {
		const mock = import("mock-require");
		const fakeCore = Object.assign({}, core);
		fakeCore.util = Object.assign({}, core.util);
		fakeCore.util.fetchFile = fetchFile;
		fakeCore.util.fetchFileAsync = fetchFileAsync;

		mock("@citation-js/core", fakeCore);
	} else {
		// start sync-request beforehand (interferes with the reporter otherwise)
		try {
			require("sync-request")();
		} catch (e) {}
	}

	return core;
};
