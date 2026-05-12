# AWS Lightsail Production Instance

## Connection Details

- **Host:** 54.187.114.114
- **User:** ubuntu
- **SSH Key:** ~/.ssh/talwet

## Quick Connect

```bash
ssh -i ~/.ssh/talwet ubuntu@54.187.114.114
```

## SCP Examples

```bash
# Copy file TO server
scp -i ~/.ssh/talwet /local/path ubuntu@54.187.114.114:~/remote/path

# Copy file FROM server
scp -i ~/.ssh/talwet ubuntu@54.187.114.114:~/remote/path /local/path

# Copy directory recursively
scp -i ~/.ssh/talwet -r ubuntu@54.187.114.114:~/remote/dir /local/dir
```

## Server Layout

- **Home:** /home/ubuntu/
- **App:** /home/ubuntu/cogitatio-virtualis/
  - cogitatio-server/ (backend)
  - virtualis-terminal/ (frontend)
- **Process Manager:** PM2

## Notes

- This is the production deployment of Cogitatio Virtualis
- Documents for vector DB: cogitatio-server/documents/
- Resume PDF: virtualis-terminal/public/resume.pdf

## Continuous Deployment

Production deploys are handled by GitHub Actions after CI passes on `master`.
The `Deploy` job connects over SSH and runs:

```bash
/home/ubuntu/cogitatio-virtualis/admin/deploy-production.sh <merge-sha>
```

The workflow requires these repository secrets:

- `LIGHTSAIL_HOST`
- `LIGHTSAIL_USER`
- `LIGHTSAIL_SSH_KEY`
- `LIGHTSAIL_KNOWN_HOSTS`

The deploy script fast-forwards the production checkout, installs and restarts
the backend when `cogitatio-server/` changes, and installs/builds/restarts the
frontend when `virtualis-terminal/` changes.
