# SPDX-License-Identifier: MIT
import http.server, functools, json, sys
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=sys.argv[1])
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler)
print(json.dumps({'port':server.server_port}),flush=True)
server.serve_forever()
