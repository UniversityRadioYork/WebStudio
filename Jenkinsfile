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
      sh 'CI=true npm_config_python=/usr/local/bin/python2.7 yarn --no-progress --non-interactive --skip-integrity-check --frozen-lockfile install'
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
          sh 'node_modules/.bin/tsc -p tsconfig.json --noEmit --extendedDiagnostics'
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
   steps {
    sh 'sed -i -e \'s/ury.org.uk\\/webstudio/ury.org.uk\\/webstudio-dev/\' package.json'
    sh 'yarn build'
    sshagent(credentials: ['ury']) {
     sh 'rsync -av --delete-after build/ deploy@ury:/usr/local/www/webstudio-dev'
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
          REACT_APP_WS_URL = 'wss://audio.ury.org.uk/webstudio/stream'
        }
        steps {
          sh 'sed -i -e \'s/ury.org.uk\\/webstudio-dev/ury.org.uk\\/webstudio/\' package.json'
          sh 'yarn build'
          sshagent(credentials: ['ury']) {
           sh 'rsync -av --delete-after build/ deploy@ury:/usr/local/www/webstudio'
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
