// @ts-check

const { JSDOM } = require("jsdom")
const fs = require('fs')
const path = require('path')

function buildMonsters() {
    const base = path.resolve(__dirname, '../content/monster')
    const monsters = []
    const files = fs.readdirSync(base) //.slice(0, 100)
    let currentFile = 0

    for (const f of files) {
        if (!/\.html$/.test(f)) {
            continue
        }
        const html = fs.readFileSync(path.join(base, f)).toString().replace(/(&nbsp;|\s|\n)+/g, ' ')

        const dom = new JSDOM(html)
        const m = dom.window.document.querySelector('.monster')

        const bodyTable = (
            dom.window.document.querySelector('.bodytable')
            || dom.window.document.querySelector('.flavor')
        ).textContent

        const levelElement = m.querySelector('.level') || { textContent: '' }
        const level = /Level (\d+) (.*) XP \d+/.exec(levelElement.textContent) || []

        monsters.push({
            file: f,
            name: m.childNodes[0].textContent.trim(),
            type: m.querySelector('.type').textContent.trim(),
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

    fs.writeFileSync(path.join(base, 'index.json'), JSON.stringify(monsters, undefined, '    '))
}
/**
 * 
 * @param {RegExp} re 
 * @param {string} content 
 * 
 * @returns {string}
 */
function extractMatch(re, content) {
    const matches = re.exec(content)
    if (!matches || matches.length < 2) {
        return ''
    }
    return matches[1]
}

buildMonsters()