import os
import sys

c = get_config()  # noqa

# 1. Spawner Configuration
c.JupyterHub.spawner_class = 'dockerspawner.DockerSpawner'
c.DockerSpawner.image = 'daggle/notebook:latest'
c.DockerSpawner.network_name = 'daggle-net'
c.DockerSpawner.remove = True
c.DockerSpawner.notebook_dir = '/home/jovyan'
c.DockerSpawner.volumes = {
    'jupyterhub-user-{username}': '/home/jovyan'
}
# We no longer need a tmpfs at /home/jovyan/input because we mount the Named Volume there directly.

# 1.5. Dynamic Kaggle-Style Infrastructure Mounts
# We reverted back to a Host Bind Mount for local development because Docker Named Volumes
# do not support sub-path mounting natively like Kubernetes PVCs do.
HOST_EXTRACTED_DATASETS_DIR = os.environ.get('HOST_EXTRACTED_DATASETS_DIR', 'd:/Documents/github/daggle/extracted_datasets')

def pre_spawn_hook(spawner):
    # Parse options passed via API or saved on the user object
    options = getattr(spawner.user, 'dataset_options', {})
    slug = options.get('dataset_slug')
    version = options.get('dataset_version', 'v1')
    
    if slug:
        # Construct the absolute path on the host for the specific dataset version
        host_path = os.path.join(HOST_EXTRACTED_DATASETS_DIR, slug, version).replace("\\", "/") 
        
        # We mount this SPECIFIC dataset version directly to /home/jovyan/input
        spawner.volumes[host_path] = {
            'bind': '/home/jovyan/input',
            'mode': 'ro'
        }
        spawner.log.info(f"Dynamically mounting Daggle dataset {slug} {version}: {host_path} -> /home/jovyan/input")
    else:
        spawner.log.info("No dataset requested; spawning standard stateless environment.")

c.Spawner.pre_spawn_hook = pre_spawn_hook

c.JupyterHub.hub_ip = '0.0.0.0'
c.JupyterHub.hub_connect_ip = 'jupyterhub'

# 2. Authenticator Configuration (Keycloak)
from oauthenticator.generic import GenericOAuthenticator
c.JupyterHub.authenticator_class = GenericOAuthenticator

c.GenericOAuthenticator.client_id = 'jupyterhub'
c.GenericOAuthenticator.client_secret = 'h57BODjRtOFbDaDUQpSrsgqTJS6RLS84'
c.GenericOAuthenticator.oauth_callback_url = 'http://localhost:8082/hub/oauth_callback'

# Internal URLs for token exchange (container to container)
c.GenericOAuthenticator.token_url = 'http://keycloak:8080/realms/daggle/protocol/openid-connect/token'
c.GenericOAuthenticator.userdata_url = 'http://keycloak:8080/realms/daggle/protocol/openid-connect/userinfo'

# Browser URLs for redirects (user's browser to Keycloak)
c.GenericOAuthenticator.authorize_url = 'http://localhost:8081/realms/daggle/protocol/openid-connect/auth'

c.GenericOAuthenticator.login_service = 'Daggle SSO'
c.GenericOAuthenticator.username_key = 'preferred_username'

c.Authenticator.allow_all = True
c.GenericOAuthenticator.auto_login = True
c.GenericOAuthenticator.scope = ['openid', 'profile', 'email']

# 2.5 Custom Handler for Daggle Launch
from jupyterhub.handlers.base import BaseHandler
from jupyterhub.utils import url_path_join
from tornado import web

class DaggleLaunchHandler(BaseHandler):
    @web.authenticated
    async def get(self):
        user = self.current_user
        slug = self.get_argument("dataset_slug", "")
        version = self.get_argument("dataset_version", "")

        if not slug:
            raise web.HTTPError(400, "dataset_slug is required")

        # Save the options to the user object itself since spawner options are cleared on stop
        user.dataset_options = {
            "dataset_slug": slug,
            "dataset_version": version
        }

        # If the server is already running, we need to cleanly stop it first
        if user.spawner.active:
            self.log.info(f"Stopping active server for {user.name} to switch dataset to {slug}/{version}")
            await user.stop()

        # Redirect to the spawn page which will start the server
        url = url_path_join(self.hub.base_url, "spawn", user.name)
        self.redirect(url)

c.JupyterHub.extra_handlers = [
    (r'/daggle-launch', DaggleLaunchHandler)
]

# 3. Idle culler
# --timeout=600     : Cull servers idle for 10+ minutes
# --cull-every=60   : Poll every 60 seconds (DEFAULT IS 0 = run once then stop!)
# --max-age=0       : Don't cull by age (0 = disabled)
# --concurrency=5   : Limit concurrent API requests to avoid Hub overload
# --cull-users=False: Only stop servers, never remove user accounts
c.JupyterHub.services = [
    {
        "name": "jupyterhub-idle-culler-service",
        "command": [
            sys.executable,
            "-m", "jupyterhub_idle_culler",
            "--timeout=3600",
            "--cull-every=60",
            "--max-age=0",
            "--concurrency=5",
            "--cull-users=False",
        ],
    }
]

c.JupyterHub.load_roles = [
    {
        "name": "jupyterhub-idle-culler-role",
        "description": "Culls idle servers",
        "scopes": [
            "list:users",
            "read:users:activity",
            "read:servers",
            "delete:servers",
        ],
        "services": ["jupyterhub-idle-culler-service"],
    }
]