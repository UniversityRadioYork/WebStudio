pipeline {
 agent {
  node {
   label 'node'
  }
 }

 stages {
  stage('Install dependencies') {
   parallel {
    stage('JavaScript') {
      steps {
        dir('client') {
          sh 'CI=true npm_config_python=/usr/local/bin/python2.7 yarn --no-progress --non-interactive --skip-integrity-check --frozen-lockfile install'
        }
      }
    }
    stage('Python') {
      steps {
        sh '/usr/local/bin/python3.7 -m venv env'
        sh 'env/bin/pip install -r requirements.ci.txt'
     }
    }
   }
  }

  stage('Type checks') {
    parallel {
      stage('TypeScript') {
        steps {
          dir('client') {
            sh 'node_modules/.bin/tsc -p tsconfig.json --noEmit --extendedDiagnostics'
          }
        }
      }
      stage('MyPy (stateserver)') {
        steps {
          sh 'env/bin/mypy stateserver.py'
        }
      }
      stage('MyPy (shittyserver)') {
        steps {
          sh 'env/bin/mypy shittyserver.py'
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
   steps {
     dir('client') {
      sh 'sed -i -e \'s/ury.org.uk\\/webstudio/ury.org.uk\\/webstudio-dev/\' package.json'
      sh 'REACT_APP_GIT_SHA=`git rev-parse --short HEAD` yarn build'
      sshagent(credentials: ['ury']) {
        sh 'rsync -av --delete-after build/ deploy@ury:/usr/local/www/webstudio-dev'
      }
    }
   }
  }
  
  stage('Build and deploy for production') {
    when {
      branch 'production'
    }
    parallel {
      stage('Deploy prod client') {
        environment {
          REACT_APP_MYRADIO_NONAPI_BASE = 'https://ury.org.uk/myradio'
          REACT_APP_MYRADIO_BASE = 'https://ury.org.uk/api/v2'
          REACT_APP_WS_URL = 'wss://ury.org.uk/webstudio/api/stream'
        }
        steps {
          dir('client') {
            sh 'sed -i -e \'s/ury.org.uk\\/webstudio-dev/ury.org.uk\\/webstudio/\' package.json'
            sh 'REACT_APP_GIT_SHA=`git rev-parse --short HEAD` REACT_APP_PRODUCTION=true yarn build'
            sshagent(credentials: ['ury']) {
              sh 'rsync -av --delete-after build/ deploy@ury:/usr/local/www/webstudio'
            }
          }
        }
      }
      stage('Deploy server') {
        steps {
          sshagent(credentials: ['ury']) {
           sh 'scp -v -o StrictHostKeyChecking=no stateserver.py liquidsoap@dolby.ury:/opt/webstudioserver/stateserver.py'
           sh 'scp -v -o StrictHostKeyChecking=no shittyserver.py liquidsoap@dolby.ury:/opt/webstudioserver/shittyserver.py'
           sh 'scp -v -o StrictHostKeyChecking=no requirements.txt liquidsoap@dolby.ury:/opt/webstudioserver/requirements.txt'
          }
        }
      }
    }
  }
 }
}
