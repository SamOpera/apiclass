# Kunle API · API Class Playground

A small REST API built with Node.js and Express, plus a playground page for sending requests and seeing how the API responds.
It shows how API keys are loaded from a `.env` file and used to protect routes.

## The two keys

| Variable in `.env` | Role | Can do | Rate limit |
|---|---|---|---|
| `TESTING` | Sandbox key | Read only | 20 requests per minute |
| `KUNLE_API` | Live key | Read and write | 120 requests per minute |

The key is sent in the `x-api-key` request header.

## Setup (Windows cmd)

Create a `.env` file in the project folder (copy `.env.example`) with:

```
TESTING=12345
KUNLE_API=090807060504030201
PORT=3000
```

Then run:

```
npm install
```

```
npm start
```

Open http://localhost:3000

## Endpoints

| Method | Path | Key needed |
|---|---|---|
| GET | `/api/health` | None |
| GET | `/api/me` | Any key |
| GET | `/api/states` (`?zone=south-west`, `?q=lag`) | Any key |
| GET | `/api/states/:slug` (e.g. `lagos`, `fct`) | Any key |
| GET | `/api/tasks` | Any key |
| GET | `/api/tasks/:id` | Any key |
| POST | `/api/tasks` | Live key |
| PATCH | `/api/tasks/:id` | Live key |
| DELETE | `/api/tasks/:id` | Live key |

Tasks are stored in memory, so they reset when the server restarts.

## Things to try in class

1. Call `/api/states` with no key. You get **401**.
2. Call it with a wrong key. Still **401**.
3. Call it with the sandbox key `12345`. You get **200**.
4. Call `POST /api/tasks` with the sandbox key. You get **403**, because sandbox is read only.
5. Call it again with the live key. You get **201 Created**.
6. Send `{"title": ""}` as the body. You get **422**.
7. Send broken JSON. You get **400**.
8. Hit any endpoint more than 20 times in a minute with the sandbox key. You get **429**.
9. Remove `TESTING` from `.env` and restart. The header chip turns red and the sandbox key stops working.

## Example with curl (cmd)

```
curl -i "http://localhost:3000/api/states/lagos" -H "x-api-key: 12345"
```

```
curl -i -X POST "http://localhost:3000/api/tasks" -H "x-api-key: 090807060504030201" -H "Content-Type: application/json" -d "{\"title\":\"Learn REST\"}"
```
