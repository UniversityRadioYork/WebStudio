pipeline {
 agent {
  node {
   label 'node'
  }
 }

 stages {
  stage('Install dependencies') {
   steps {
    sh 'CI=true npm_config_python=/usr/local/bin/python2.7 yarn --no-progress --non-interactive --skip-integrity-check --frozen-lockfile install'
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
    steps {
      sh 'sed -i -e \'s/ury.org.uk\\/webstudio-dev/ury.org.uk\\/webstudio/\' package.json'
      sh 'yarn build'
      sshagent(credentials: ['ury']) {
       sh 'rsync -av --delete-after build/ deploy@ury:/usr/local/www/webstudio'
      }
    }
  }
 }
}
