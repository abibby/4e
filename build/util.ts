import { readFile, readdir, writeFile } from 'fs/promises'
import { join, resolve } from 'path'

export function extractMatch(re: RegExp, content: string): string {
    const matches = re.exec(content)
    if (!matches || matches.length < 2) {
        return ''
    }
    return matches[1]
}

export async function createIndex<T>(
    dir: string,
    skip: string[],
    cb: (html: string, file: string) => T,
) {
    const base = resolve(__dirname, dir)

    const items: T[] = []
    const files = await readdir(base) //.slice(0, 100)
    let currentFile = 0

    for (const f of files) {
        if (!/\.html$/.test(f)) {
            continue
        }

        if (skip.includes(f)) {
            continue
        }

        const html = (await readFile(join(base, f)))
            .toString()
            .replace(/(&nbsp;|\s|\n)+/g, ' ')

        const item = cb(html, f)
        if (item !== undefined) {
            items.push(item)
        } else {
            console.log(`skipped ${f}`)
        }

        if (currentFile % 100 === 0) {
            console.log(currentFile, '/', files.length)
        }

        currentFile++
    }

    await writeFile(
        join(base, 'index.json'),
        JSON.stringify(items, undefined, '    '),
    )
}
