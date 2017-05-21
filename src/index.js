import fs from 'fs'
import keypair from 'keypair'
import GitHubApi from 'github'
import axios from 'axios'
import { Base64 } from 'js-base64'
import forge from 'node-forge'


Base64.extendString();

const GITHUB_TOKEN = 'ccf81ff7d7a4c56702db550e8fb13e557219ad30'
const CIRCLE_HOST = 'https://circleci.com/api/v1.1/'
const TOKEN = '63b99e406f1807f3c3348df98c35240d01621152'
const SYNCANO_TOKEN = '0aad29dd0be2bcebb741525b9c5901e55cf4dc98'


const github = new GitHubApi();
github.authenticate({
    type: 'token',
    token: GITHUB_TOKEN,
});

const circleCall = (method, url, params = {}) => {
  const paramsWithToken = Object.assign(params, {'circle-token': TOKEN})
  return axios({
    method,
    baseURL: CIRCLE_HOST,
    url: url,
    params: method === 'get' ? paramsWithToken : {'circle-token': TOKEN},
    data: method === 'post' ? paramsWithToken : {}
  })
}

const socketName = 'test5'
const githubUser = 'mkucharz'
const githubUserEmail = 'm@kucharz.net'
const repoName = `syncano-socket-${socketName}`

const pair = keypair()
const publicKey = forge.pki.publicKeyFromPem(pair.public)
const sshPubKey = forge.ssh.publicKeyToOpenSSH(publicKey, 'm@kucharz.net')

const CIRCLE_VARIABLES = {
  GITHUB_NAME: githubUser,
  GITHUB_EMAIL: githubUserEmail,
  SOCKET_NAME: socketName,
  SYNCANO_AUTH_KEY: SYNCANO_TOKEN
}

console.log('Creating repo...')
github.repos.create({
  name: `syncano-socket-${socketName}`,
  has_projects: false,
  has_wiki: false,
})
.then(resp => {
  console.log('Creating Circle file...')
  return github.repos.createFile({
    owner: githubUser,
    repo: repoName,
    path: 'circle.yml',
    message: 'Adding circleci',
    content: fs.readFileSync('circle.yml.tmpl').toString().toBase64()
  })

})
.then(() => {
  console.log('Setting Circle to follow a project...')
  return circleCall('post', `project/github/${githubUser}/${repoName}/follow`)
})
.then(() => {
  console.log('Setting Circle variables...')
  Promise.all(
    Object.keys(CIRCLE_VARIABLES).map(key => {
      return circleCall(
        'post',
        `project/github/${githubUser}/${repoName}/envvar`,
        { name: key, value: CIRCLE_VARIABLES[key]}
      )
    })
  )
})
.then(() => {
  console.log('Setting SSH key in Circle...')
  return circleCall('post', `project/github/${githubUser}/${repoName}/ssh-key`, {hostname: 'github.com', private_key: pair.private})
})
.then(() => {
  console.log('Setting SSH key in Github...')
  return github.repos.createKey({
    owner: githubUser,
    repo: repoName,
    title: 'Circle CI read-write key',
    read_only: false,
    key: sshPubKey
  })
})
.then(() => {
  console.log('All done!')
})
.catch(err => {
  console.log(err)
})
