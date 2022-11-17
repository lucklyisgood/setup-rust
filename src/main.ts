import * as core from '@actions/core'
import * as io from '@actions/io'
import * as cache from '@actions/cache'
import * as tool_cache from '@actions/tool-cache'
import * as exec from '@actions/exec'
import {homedir} from 'os'
import path from 'path'
import {promises} from 'fs'

const RUST_CACHE_PATH = [path.join(homedir(), '.rustup', 'toolchains')]
const RUST_DOWNLOAD_ARGS = ['--default-toolchain', 'none', '-y'] // don't install any
const RUST_INSTALL_UNIX_URL = 'https://sh.rustup.rs'
const RUST_INSTALL_WIN_URL = 'https://win.rustup.rs'

async function installRustup(): Promise<void> {
  try {
    await io.which('rustup', true)
  } catch (error) {
    core.info('rustup not exist!!!')
    const plat = process.platform
    if (!!plat.match('/(darwin|linux)/')) {
      core.info(`starting install rustup in ${plat}`)
      const rustupSh = await tool_cache.downloadTool(RUST_INSTALL_UNIX_URL)
      await promises.chmod(rustupSh, 0o755)
      await exec.exec(rustupSh, RUST_DOWNLOAD_ARGS)
    } else if (plat === 'win32') {
      core.info('starting install rustup in win32')
      const rustupWin = await tool_cache.downloadTool(RUST_INSTALL_WIN_URL)
      await exec.exec(rustupWin, RUST_DOWNLOAD_ARGS)
    } else {
      throw new Error(`current os is not support${plat}!!!`)
    }
    core.addPath(path.join(homedir(), '.cargo', 'bin'))
  }
  core.info('install rustup finish!')
}

function buildArgs(
  channel: string,
  components: string,
  targets: string
): string[] {
  let args = [
    'toolchain',
    'install',
    channel,
    '--profile',
    'minimal',
    '--allow-downgrade'
  ]
  if (!!components) {
    components.split(' ').forEach(v => {
      args.push('--component')
      args.push(v)
    })
  }
  if (!!targets) {
    targets.split(' ').forEach(v => {
      args.push('--target')
      args.push(v)
    })
  }
  return args
}

async function run(): Promise<void> {
  try {
    await installRustup()
    const plat = process.platform
    // input
    const channel: string = core.getInput('rust-channel', {required: true})
    const components: string = core.getInput('components')
    const targets: string = core.getInput('targets')

    const cacheKey = `rust-${plat}-${channel}${
      !!components ? '-' : ''
    }${components.replace(' ', '-')}${!!targets ? '-' : ''}${targets.replace(
      ' ',
      ';;'
    )}`
    // -${components.replace(' ', '-')}-${targets}

    await cache.restoreCache(RUST_CACHE_PATH, cacheKey)

    const args = buildArgs(channel, components, targets)
    core.info(`rust install args: ${args.toString()}`)

    let exitCode = 0

    exitCode = await exec.exec('rustup', args)
    if (exitCode !== 0) {
      throw new Error(`install toolchain fail, exit code: ${exitCode}`)
    }

    core.info(`setting the default channel: ${channel}`)
    exitCode = await exec.exec('rustup', ['default', channel])
    if (exitCode !== 0) {
      throw new Error(`setting default toolchain fail, exit code: ${exitCode}`)
    }

    core.info(`saving cache: ${cacheKey}`)

    try {
      await cache.saveCache(RUST_CACHE_PATH, cacheKey)
    } catch (error) {
      core.info(`Cache hit occurred on key ${cacheKey}, not saving cache.`)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
