const path = require('path');
const fs = require('fs');
const fsPromise = require('fs/promises');
const https = require('https');
const readline = require('readline');

const dtsDiff = require('../dist/index');
const { constants } = require('buffer');

const tagsUrl = 'https://github.com/microsoft/vscode/refs-tags/1.50.0/src/vs/vscode.d.ts?source_action=show&source_controller=blob&tag_name=1.50.0&q=';
const srcTemplate = 'https://raw.githubusercontent.com/microsoft/vscode/{tag}/src/vs/vscode.d.ts';

function downloadString(url) {
    return new Promise((resolve, reject)=>{
        https.get(url, res=>{
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', ()=>{
                resolve(rawData);
            });            
            res.on('error', e=>{
                reject(e);
            });
        });
    });
}

function getAllVersionTags() {
    return downloadString(tagsUrl).then(rawData=>{
        const reg = /href="([^"]+)"/gi;
        const tagReg = /\/(\d+\.\d+\.\d+)\//;
        var hrefMatch = null;
        let lastMatchIndex = -1;
        const tags = [];
        while(hrefMatch = reg.exec(rawData)) {
            if(lastMatchIndex == hrefMatch.index) {
                break;
            }
            lastMatchIndex = hrefMatch.index;
            const href = hrefMatch[1];
            const tagMatch = tagReg.exec(href);
            if(tagMatch) {
                tags.push(tagMatch[1]);
            }
        }
        return tags;
    });
}

/**
 * 
 * @param {string} a version 1
 * @param {string} b version 2
 */
function sortVersion(a, b) {
    const av = a.split('.');
    const bv = b.split('.');
    for(var n = 0; n < av.length && n < bv.length; n++) {
        const an = parseInt(av[n]);
        const bn = parseInt(bv[n]);
        if(an != bn) {
            return an - bn;
        }
    }
    if(av.length != bv.length) {
        return av.length - bv.length;
    }
    return a.localeCompare(b);
}

function writeCurrentLine(msg) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stdout.write(msg);
}

async function fsExists(file) {
    return fsPromise.access(file, fs.constants.F_OK).then(()=>true).catch(()=>false);
}

async function loadTagCache(tag) {
    try {
        const d = path.join(__dirname, 'cache');
        const p = path.join(d, tag);
        if(!await fsExists(d)) {
            return;
        }
        const stat = await fsPromise.stat(p);
        if(stat.isFile()){
            return await fsPromise.readFile(p, {encoding: 'utf-8'});
        }
    }
    catch{}
}

async function saveTagCache(tag, content) {
    const d = path.join(__dirname, 'cache');
    const p = path.join(d, tag);
    if(!await fsExists(d)) {
        fsPromise.mkdir(d);
    }
    await fsPromise.writeFile(p, content, 'utf-8');
}

async function run() {
    const useCache = process.argv.includes('-c') || process.argv.includes('--cache');
    process.stdout.write('loading all version tags...');
    const tags = await getAllVersionTags();
    tags.sort(sortVersion)
    process.stdout.write(`${tags.length} tags.\n`);

    const sources = [];
    
    for(var i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if(useCache) {
            try{
                const content = await loadTagCache(tag);
                if(content) {
                    writeCurrentLine(`${i+1}/${tags.length} loaded tag \`${tag}\` from cache`);
                    sources.push({tag: tag, fileName: 'vscode.d.ts', content: content});
                    continue;
                }
            }
            catch{}
        }
        writeCurrentLine(`${i+1}/${tags.length} downloading tag \`${tag}\`...`);
        const tagUrl = srcTemplate.replace('{tag}', tag);
        const content = await downloadString(tagUrl);
        if(useCache) {
            await saveTagCache(tag, content);
        }
        sources.push({tag: tag, fileName: 'vscode.d.ts', content: content});
    }
    console.log('All version tags has downloaded');
    const result = await dtsDiff.parse({sources, timelineFirstAddAllFirst: true});
    const output = path.join(__dirname, 'vscode-api-diff.json');
    await fsPromise.writeFile(output, JSON.stringify(result, undefined, '\t'));
    console.log('Version diff has output at `%s`', output);
}

run();