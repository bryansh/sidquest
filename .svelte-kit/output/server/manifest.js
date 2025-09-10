export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.C0g7jZOB.js",app:"_app/immutable/entry/app.DaSLlgHr.js",imports:["_app/immutable/entry/start.C0g7jZOB.js","_app/immutable/chunks/DXVEpyOv.js","_app/immutable/chunks/xaizLjRp.js","_app/immutable/chunks/NWl2AK9E.js","_app/immutable/entry/app.DaSLlgHr.js","_app/immutable/chunks/NWl2AK9E.js","_app/immutable/chunks/E-vkuI0X.js","_app/immutable/chunks/xaizLjRp.js","_app/immutable/chunks/Czpd1Vjn.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
