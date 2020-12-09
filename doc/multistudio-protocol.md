# MultiStudio Protocol

## Conventions

Message sent from the client to the server are denoted `c->s`, the converse `s->c`.

## Protocol Basics

Everything message MUST be JSON over a WebSocket. Every message, whether c->s or s->c, MUST have a `kind` field.

The client MAY include a string field called `rid` ("Request ID). If included, the server MUST echo it in all messages relating to the client's message. The server MUST NOT make any other assumptions about the `rid` field.

Errors MUST have a `kind` with an error code from the Four-Character Status Code (4CC) specification (M. B. Windsor, L. Wallis, 2013), and a `why` with a unique code describing the specific error case.

## Connecting

The first message in a connection MUST be a c->s with kind `HELLO`. If the server does not receive one within five seconds of the client connecting, it MAY terminate the connection there and then.

The server will reply with a s->c with kind `HELLO`, a `MultiUser` object, boolean `reconnected` and string `reconnect_token` (described below).

### Reconnecting

The internet is a scary place and sometimes connections can die for any reason. Because of this, the MultiStudio Protocol has a reconnecting mechanism.

The server's s->c `HELLO` message MAY contain a string `reconnect_token`. The client SHOULD store it somewhere. The token can be any string; the client MUST treat it as an opaque token and MUST NOT make any assumptions about its format beyond the fact that it's a string of reasonable length.

If the client loses connection abnormally, it MAY send the `reconnect_token` in its c->s `HELLO`. If the token is valid, the server MAY reply with `"reconnected": true` in the s->c `HELLO`. The `HELLO`'s user data will then be the user data from the previous connection. If the user was in a room then, the server MAY also send a `JOINED_ROOM` (below).

Tokens MAY expire at any time and the client MUST NOT make any assumptions about their validity. If the client sent a reconnect token, but the server replied `"reconnected": false`, the client MUST assume that the token is invalid and no longer use it.