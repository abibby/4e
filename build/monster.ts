import fs from 'fs'
import { JSDOM } from 'jsdom'
import path from 'path'
import { extractMatch } from './util'

export interface Monster {
    file: string
    name: string
    type: string
    level: number
    role: string
    hp: number
    ac: number
    fortitude: number
    reflex: number
    will: number
    speed: number
}

export function buildMonsters(): void {
    const base = path.resolve(__dirname, '../content/monster')
    const monsters: Monster[] = []
    const files = fs.readdirSync(base) //.slice(0, 100)
    let currentFile = 0

    for (const f of files) {
        if (!/\.html$/.test(f)) {
            continue
        }

        const skip = ['Amber Monkey.html', 'Bloodstone Spider.html']
        if (skip.includes(f)) {
            continue
        }

        const html = fs
            .readFileSync(path.join(base, f))
            .toString()
            .replace(/(&nbsp;|\s|\n)+/g, ' ')

        const dom = new JSDOM(`<html>${html}</html`)
        const doc = dom.window.document
        const m = doc.querySelector('.monster')
        if (m === null) {
            throw `No .monster class for ${f}`
        }

        const bodyTable =
            (
                dom.window.document.querySelector('.bodytable') ??
                dom.window.document.querySelector('.flavor')
            )?.textContent ?? ''

        const levelElement =
            m.querySelector('.level') ?? doc.querySelector('.monster')
        const levelText = levelElement?.textContent ?? null
        if (levelText === null) {
            throw `Could not find level for ${f}`
        }

        const level = /Level (\d+) (.*)(?: XP \d+)?/.exec(levelText)
        if (level === null || level.length <= 2) {
            throw `Could not parse level, '${levelText}' for ${f}`
        }

        monsters.push({
            file: f,
            name: m.childNodes[0].textContent?.trim() ?? 'N/A',
            type: m.querySelector('.type')?.textContent?.trim() ?? 'N/A',
            level: parseInt(level[1]),
            role: level[2].trim(),
            hp: parseInt(extractMatch(/HP (\d+)/, bodyTable)),
            ac: parseInt(extractMatch(/AC (\d+)/, bodyTable)),
            fortitude: parseInt(extractMatch(/Fortitude (\d+)/, bodyTable)),
            reflex: parseInt(extractMatch(/Reflex (\d+)/, bodyTable)),
            will: parseInt(extractMatch(/Will (\d+)/, bodyTable)),
            speed: parseInt(extractMatch(/Speed (\d+)/, bodyTable)),
        })

        if (currentFile % 100 === 0) {
            console.log(currentFile, '/', files.length)
        }

        currentFile++
    }

    fs.writeFileSync(
        path.join(base, 'index.json'),
        JSON.stringify(monsters, undefined, '    '),
    )
}
