Through Arjun's [week 5 project](https://arjunmakesthings.github.io/shared-minds_f26/week-5/) in his [Shared Minds](https://arjunmakesthings.github.io/itp-blog/shared-minds/) course, I realised that the *Backend as a Service* (*BaaS*) computing  model can help me host this game on the public for free. I've tried doing that for a while now, even setting up my PC as a homeserver but realized that the game was too slow on that. Today, I explore this

This is going to be a relatively large migration, as I would need to completely do away with the go server I currently have.

### Supabase
#### What is it?
It's basically a hosted backend service which is an alternative to Google's [Firebase](https://firebase.google.com/). A project on Supabase gives you access to a database, authentication, edge functions, and every backend-related need you might have for your project.

### Render
During the research, I also asked Codex to give me alternatives to the supabase migration. Render, apparently, has a free tier where I can host the game with minimal code changes.
#### Supporting this deployment
My game currently exposes 2 ports, 1 for connecting to the REST API and another to connect to the WS client. Render only allows exposing one port, so I'll have to make this change first.

### Final approach
We're going ahead with render for now. I do want to experiment with cloud workers later but this game, specially in its current state, is not really the best use case for it.

#### Code changes
I first asked codex to use one backend port instead of 2. Other than supporting the Render deployment, this will also simplify local development.

##### One Backend port
- Frontend
	- Updated `WS_BASE_URL` in `frontend/src/lib/config.ts`
	- Updated `VITE_BASE_URL` in `frontend/Dockerfile`
- Backend
	- remove `WsPort` from `backend/config/config.go`. Also remove those references in `backend/cmd/server/main.go`
	- Update `backend/Dockerfile`
- Other
	- Removed the now obsolete `WS_PORT` variable from `.vscode/launch.json`
	- Update k8s deployment manifests and readme file
