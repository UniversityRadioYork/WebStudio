def NODE_IMAGE = 'node:22.23.2-bookworm'
def PYTHON_IMAGE = 'astral/uv:python3.14-bookworm'

pipeline {
  agent {
    node {
      label 'docker'
    }
  }

  stages {
    stage('Prepare') {
      parallel {
        stage('Client') {
          agent {
            docker {
              image NODE_IMAGE
              reuseNode true
            }
          }

          stages {
            stage('Install dependencies') {
              steps {
                sh 'CI=true yarn --no-progress --non-interactive --skip-integrity-check --frozen-lockfile install'
              }
            }

            stage('Typecheck') {
              steps {
                sh 'yarn check:types'
              }
            }
          }
        }

        stage('Server') {
          agent {
            docker {
              image PYTHON_IMAGE
              reuseNode true
            }
          }

          stages {
            stage('Install dependencies') {
              steps {
                sh 'uv sync --locked'
              }
            }

            stage('MyPy') {
              steps {
                sh 'uv run mypy stateserver.py'
                sh 'uv run mypy shittyserver.py'
              }
            }
          }
        }
      }
    }

    stage('Build and deploy to dev instance') {
      agent {
        docker {
          image NODE_IMAGE
          reuseNode true
        }
      }

      when {
        anyOf {
          branch 'master'
          branch 'production'
        }
      }
      environment {
        SENTRY_AUTH_TOKEN = credentials('sentry-auth-token')
        SENTRY_ORG = 'university-radio-york'
        SENTRY_PROJECT = 'webstudio'
        SENTRY_ENVIRONMENT = 'webstudio-dev'
      }
      steps {
        sh 'jq \'.homepage = "https://ury.org.uk/webstudio-dev"\' package.json > package-replace.json && mv package-replace.json package.json'
        sh 'REACT_APP_GIT_SHA=`git rev-parse --short HEAD` yarn build'
        sshagent(credentials: ['ury']) {
          sh 'rsync -av --delete-after build/ deploy@ury:/usr/local/www/webstudio-dev'
        }
      }
      post {
        success {
          sh '''
            export SENTRY_RELEASE="$(jq -r '.version' package.json)-$(git rev-parse --short HEAD)"
            yarn sentry-cli releases new -p $SENTRY_PROJECT $SENTRY_RELEASE
            yarn sentry-cli releases set-commits $SENTRY_RELEASE --auto
            yarn sentry-cli releases files $SENTRY_RELEASE upload-sourcemaps build/static/js --url-prefix '/webstudio-dev/static/js'
            yarn sentry-cli releases finalize $SENTRY_RELEASE
            yarn sentry-cli releases deploys $SENTRY_RELEASE new -e $SENTRY_ENVIRONMENT
          '''
        }
      }
    }
  }
}
