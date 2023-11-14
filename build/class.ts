import { JSDOM } from 'jsdom'
import { createIndex, extractMatch } from './util'

export interface Class {
    name: string
    role: string
}

export async function buildClasses() {
    await createIndex('../content/class', [], (html, f): Class => {
        const dom = new JSDOM(`<html>${html}</html`)
        const doc = dom.window.document

        const name = doc.querySelector('.player')

        if (name === null) {
            throw `no .player class for ${f}`
        }
        const flavor = doc.querySelector('.flavor')

        console.log(flavor?.textContent)

        return {
            name: name.textContent ?? '',
            role: extractMatch(/Role: ([a-zA-Z]+)/, flavor?.textContent ?? ''),
        }
    })
}
