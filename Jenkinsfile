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
          stages {
            stage('Install dependencies') {
              steps {
                sh 'CI=true yarnpkg install --immutable'
              }
            }

            stage('Typecheck') {
              steps {
                sh 'yarnpkg check:types'
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
                sh 'uv sync --no-cache --locked'
              }
            }

            stage('MyPy') {
              steps {
                sh 'uv run --no-cache mypy stateserver.py'
                sh 'uv run --no-cache mypy shittyserver.py'
              }
            }
          }
        }
      }
    }

    stage('Build and deploy to dev instance') {
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
        sh 'sed -i -e \'s|"./",|"https://ury.org.uk/webstudio-dev",|\' package.json'
        sh 'REACT_APP_GIT_SHA=`git rev-parse --short HEAD` yarnpkg build'
        sshagent(credentials: ['deploy2']) {
          sh 'rsync -av --delete-after build/ deploy@ury.york.ac.uk:/usr/local/www/webstudio-dev'
        }
      }

      post {
        success {
          sh '''
            export SENTRY_RELEASE="$(jq -r '.version' package.json)-$(git rev-parse --short HEAD)"
            yarnpkg sentry-cli releases new -p $SENTRY_PROJECT $SENTRY_RELEASE
            yarnpkg sentry-cli releases set-commits $SENTRY_RELEASE --auto
            yarnpkg sentry-cli releases sourcemaps upload build/static/js --url-prefix '/webstudio-dev/static/js'
            yarnpkg sentry-cli releases finalize $SENTRY_RELEASE
            yarnpkg sentry-cli releases deploys $SENTRY_RELEASE new -e $SENTRY_ENVIRONMENT
          '''
        }
      }
    }

    stage('Build and deploy for production') {
      when {
        branch 'production'
      }

      environment {
        SENTRY_AUTH_TOKEN = credentials('sentry-auth-token')
        SENTRY_ORG = 'university-radio-york'
        SENTRY_PROJECT = 'webstudio'
        SENTRY_ENVIRONMENT = 'production'
      }

      parallel {
        stage('Deploy prod client') {
          environment {
            REACT_APP_MYRADIO_NONAPI_BASE = 'https://ury.org.uk/myradio'
            REACT_APP_MYRADIO_BASE = 'https://ury.org.uk/api/v2'
            REACT_APP_WS_URL = 'wss://ury.org.uk/webstudio/api/stream'
          }
          steps {
            sh 'sed -i -e \'s|ury.org.uk/webstudio-dev|ury.org.uk/webstudio|\' package.json'
            sh 'REACT_APP_GIT_SHA=`git rev-parse --short HEAD` REACT_APP_PRODUCTION=true yarnpkg build'
            sshagent(credentials: ['deploy2']) {
              sh 'rsync -av --delete-after build/ deploy@ury.york.ac.uk:/usr/local/www/webstudio'
            }
          }
          post {
            success {
              sh '''
                export SENTRY_RELEASE="$(node scripts/get-version.js)-$(git rev-parse --short HEAD)"
                sentry-cli releases new -p $SENTRY_PROJECT $SENTRY_RELEASE
                sentry-cli releases set-commits $SENTRY_RELEASE --auto
                sentry-cli releases sourcemaps upload build/static/js --url-prefix '/webstudio/static/js'
                sentry-cli releases finalize $SENTRY_RELEASE
                sentry-cli releases deploys $SENTRY_RELEASE new -e $SENTRY_ENVIRONMENT
              '''
            }
          }
        }

        stage('Deploy server') {
          steps {
            sshagent(credentials: ['dolby-deploy']) {
              sh 'scp -v -o StrictHostKeyChecking=no stateserver.py liquidsoap@dolby.ury.york.ac.uk:/opt/webstudioserver/stateserver.py'
              sh 'scp -v -o StrictHostKeyChecking=no shittyserver.py liquidsoap@dolby.ury.york.ac.uk:/opt/webstudioserver/shittyserver.py'
              sh 'scp -v -o StrictHostKeyChecking=no pyproject.toml liquidsoap@dolby.ury.york.ac.uk:/opt/webstudioserver/pyproject.toml'
              sh 'scp -v -o StrictHostKeyChecking=no uv.lock liquidsoap@dolby.ury.york.ac.uk:/opt/webstudioserver/uv.lock'
            }
          }
        }
      }
    }
  }
}
