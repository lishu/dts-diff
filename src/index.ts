import { createSourceFile, Node, InterfaceDeclaration, ModuleDeclaration, ScriptKind, ScriptTarget, SourceFile, SyntaxKind, SyntaxList, EnumDeclaration, ClassDeclaration, TypeAliasDeclaration, FunctionDeclaration, Declaration } from 'typescript';
import { readFile } from 'fs';

/** diff source info */
export interface IDiffSource {
    /** Option tag, replace `fileName` in `from/to/at` result property */
    tag?: string;
    /** .d.ts file name */
    fileName: string;
    /** .d.ts file content */
    content: string;
}

/** The Diff Kind */
export enum DiffItemKind {
    /** New Item Added */
    Added,
    /** Item Changed */
    Changed,
    /** Item Removed */
    Removed,
    /** Item has comment Deprecated */
    Deprecated,
}

export interface IDiffItemResult {
    /**
     * From source file, tag or fileName
     */
    from: string;
    /**
     * To source file, tag or fileName
     */
    to: string;
    /** Diff kind */
    kind: DiffItemKind;
    /** Path of diff item */
    path: string;
}

export interface IDiffTimeResult {
    /**
     * At source file, tag or fileName
     */
    at: string;
    /** Diff kind */
    kind: DiffItemKind;
}

export interface IDiffTimelineResult {
    /** Path of diff item */
    path: string;
    changes: IDiffTimeResult[];
}

export interface IDiffResult {
    items: IDiffItemResult[];
    timelines: IDiffTimelineResult[];
}

export interface IDiffCallback {
    (result?: IDiffResult, err?: any):void;
}

/** Parser Options */
export interface IDiffParserOptions {
    /** All need handle sources */
    sources: IDiffSource[];
    /** Make first source file all items in timeline added */
    timelineFirstAddAllFirst?: boolean;
}

function optionValid(options: IDiffParserOptions) {
    if(options.sources.length < 2) {
        throw new Error('Options error! `options.sources` should less has two items.');
    }
}

/**
 * Load a local file as `IDiffSource`.
 * @param fileName The .d.ts filename will loaded.
 * @param tag DiffSource tag
 * @returns `Promise` of `IDiffSource`.
 */
export function loadSource(fileName: string, tag?: string) : Promise<IDiffSource>  {
    return new Promise((resolve, reject)=>{
        readFile(fileName, {encoding: 'utf-8'}, (err, data)=> {
            if(err) {
                reject(err);
                return;
            }
            resolve({
                tag,
                fileName,
                content: data
            });
        });
    });
}

interface IItem {
    kind: SyntaxKind;
    node: Node;
    sign: string;
    fullname: string;
    signs: string[];
    child: IItem[];
    deprecated?: boolean;
}

function getFullname(sign: string, parent?: IItem) {
    if(parent) {
        return parent.fullname + '.' + sign;
    }
    return sign;
}

function findOrAppend(items: IItem[], kind: SyntaxKind, sign: string, node: Node, parent?: IItem) {
    let fullname = getFullname(sign, parent);
    let item = items.find(p=>p.kind == kind && p.fullname == fullname);
    if(!item) {
        item = {
            kind,
            node,
            fullname,
            sign,
            signs: [],
            child: [],
        };
        items.push(item);
    }
    return item;
}


function handleSyntaxList(items: IItem[], s: SourceFile, mod: ModuleDeclaration, modItem: IItem, syntaxList: SyntaxList) {
    for(let child of syntaxList._children) {
        switch(child.kind) {
            case SyntaxKind.SyntaxList:
                handleSyntaxList(items, s, mod, modItem, <SyntaxList>child);
                break;
            case SyntaxKind.ModuleDeclaration:
                handleModuleDec(items, s, <ModuleDeclaration>child, modItem);
                break;
            case SyntaxKind.InterfaceDeclaration:
                handleInterfaceDec(items, s, <InterfaceDeclaration>child, modItem);
                break;
            case SyntaxKind.ClassDeclaration:
                handleClassDec(items, s, <ClassDeclaration>child, modItem);
                break;
            case SyntaxKind.FunctionDeclaration:
                handleFunctionDec(items, s, <FunctionDeclaration>child, modItem);
                break;
            case SyntaxKind.EnumDeclaration:
                handleEnumDec(items, s, <EnumDeclaration>child, modItem);
                break;
            case SyntaxKind.TypeAliasDeclaration:
                handleTypeAliasDec(items, s, <TypeAliasDeclaration>child, modItem);
                break;
            case SyntaxKind.FirstStatement:
                // console.log(`FirstStatement: pos = ${child.pos}, end = ${child.end}`);
                // console.log(child.getText(s));
                break;
            default:
                console.log('handleSyntaxList kind', child.kind);
                break;
        }
    }
}

function handleModuleDec(items: IItem[], s: SourceFile, mod: ModuleDeclaration, parent?: IItem) {
    const name = mod.name.getText(s);
    // console.debug('处理模块 ' + name);
    const modItem = findOrAppend(items, SyntaxKind.ModuleDeclaration, name, mod, parent);
    if(mod.body) {
        let children = mod.body.getChildren(s)
        for(let child of children) {
            switch(child.kind) {
                case SyntaxKind.SyntaxList:
                    handleSyntaxList(items, s, mod, modItem, <SyntaxList>child);
                    break;
                case SyntaxKind.OpenBraceToken:
                case SyntaxKind.CloseBraceToken:
                    break;
                default:
                    console.log('handleModuleDec kind', child.kind);
                    break;
            }
        }
    }
}

function handleEnumDec(items: IItem[], s: SourceFile, enu: EnumDeclaration, parent?: IItem) {
    const name = enu.name.getText(s);
    // console.debug('处理枚举 ' + name);
    const item = findOrAppend(items, SyntaxKind.EnumDeclaration, name, enu, parent);
    enu.members.forEach(m=>{
        let enumItem = m.name.getText(s);
        findOrAppend(items, SyntaxKind.EnumMember, enumItem, m, item);
    });
}

function handleTypeAliasDec(items: IItem[], s: SourceFile, typ: TypeAliasDeclaration, parent?: IItem) {
    const name = typ.name.getText(s);
    // console.debug('处理别名 ' + name);
    const item = findOrAppend(items, SyntaxKind.TypeAliasDeclaration, name, typ, parent);
}

function isDeprecated(s: SourceFile, d: Declaration): boolean {
    const fullText = d.getFullText(s);
    return (fullText && fullText.includes('@deprecated'));
}

function handleInterfaceDec(items: IItem[], s: SourceFile, inf: InterfaceDeclaration, parent?: IItem) {
    const name = inf.name.getText(s);
    // console.debug('处理接口 ' + name);
    const item = findOrAppend(items, SyntaxKind.InterfaceDeclaration, name, inf, parent);
    inf.members.forEach(m=>{
        if(m.name) {
            let memberName = m.name.getText(s);
            findOrAppend(items, m.kind, memberName, m, item).deprecated = isDeprecated(s, m);
            return;
        }
        if(m.kind == SyntaxKind.CallSignature || m.kind == SyntaxKind.IndexSignature) {
            findOrAppend(items, m.kind, m.getText(s), m, item);
            return;
        }
        console.warn(m.kind);
    });
}

function handleClassDec(items: IItem[], s: SourceFile, cls: ClassDeclaration, parent?: IItem) {
    const name = cls.name.getText(s);
    // console.debug('处理类型 ' + name);
    const item = findOrAppend(items, SyntaxKind.ClassDeclaration, name, cls, parent);
    cls.members.forEach(m=>{
        if(m.name) {
            let memberName = m.name.getText(s);
            findOrAppend(items, m.kind, memberName, m, item).deprecated = isDeprecated(s, m);
            return;
        }
        if(m.kind == SyntaxKind.CallSignature || m.kind == SyntaxKind.IndexSignature || m.kind == SyntaxKind.Constructor) {
            findOrAppend(items, m.kind, m.getText(s), m, item);
            return;
        }
        console.warn(m.kind);
    });
}

function handleFunctionDec(items: IItem[], s: SourceFile, fun: FunctionDeclaration, parent?: IItem) {
    const name = fun.name.getText(s);
    // console.debug('处理函数 ' + name);
    const item = findOrAppend(items, SyntaxKind.FunctionDeclaration, name, fun, parent);
    
}

function getDec(a: SourceFile) : IItem[] {
    let items : IItem[] = [];
    a.statements.forEach(statement=>{
        switch(statement.kind) {
            case SyntaxKind.ModuleDeclaration:
                handleModuleDec(items, a, <ModuleDeclaration>statement);
                break;
            case SyntaxKind.InterfaceDeclaration:
                handleInterfaceDec(items, a, <InterfaceDeclaration>statement);
                break;
            default:
                console.warn(`未处理语法类 ${statement.kind}`);
        }
    })
    items = items.sort((a,b)=>a.fullname.localeCompare(b.fullname));
    return items;
}

function logItems(items: IItem[]) {
    items = items.sort((a,b)=>a.fullname.localeCompare(b.fullname));
    for(let item of items) {
        console.log(item.kind, item.fullname);
    }
}

function diff(a: SourceFile, b: SourceFile) {
    const news : string[] = [];
    const olds : string[] = [];
    const deps : string[] = [];
    const adec = getDec(a);
    const bdec = getDec(b);
    let aidx = 0;
    let bidx = 0;
    while(aidx < adec.length && bidx < bdec.length) {
        let an = adec[aidx].fullname;
        let bn = bdec[bidx].fullname;
        let cs = an.localeCompare(bn);
        if(cs == 0) {
            if(bdec[bidx].deprecated && !adec[aidx].deprecated) {
                deps.push(bdec[bidx++].fullname);
            }
            aidx++;
            bidx++;
        } else if (cs > 0) {
            news.push(bdec[bidx++].fullname);
        } else {
            olds.push(adec[aidx++].fullname);
        }
    }
    return {news, olds, deps};
}

function getOrCreateTime(timelines: IDiffTimelineResult[], path: string) {
    let timeItem = timelines.find(t=>t.path === path);
    if(!timeItem) {
        timeItem = {
            path,
            changes: []
        };
        timelines.push(timeItem);
    }
    return timeItem;
}

export function parse(options: IDiffParserOptions) : Promise<IDiffResult>;
export function parse(options: IDiffParserOptions, callback: IDiffCallback) : void;
export function parse(options: IDiffParserOptions, callback?: IDiffCallback) : Promise<IDiffResult> | void {
    const done = callback ? r => callback(r) : r => Promise.resolve(r);
    const fail = callback ? e => callback(undefined, e) : e => Promise.reject(e);
    try{
        optionValid(options);
        const sources = options.sources.map(src=>createSourceFile(src.fileName, src.content, ScriptTarget.Latest, false, ScriptKind.TS));
        const items: IDiffItemResult[] = [];
        const timelines: IDiffTimelineResult[] = [];
        let from = sources[0];
        if(options.timelineFirstAddAllFirst) {
            const at = options.sources[0].tag || options.sources[0].fileName;
            getDec(sources[0]).forEach(d=>{
                timelines.push({
                    path: d.fullname,
                    changes: [{
                        at,
                        kind: DiffItemKind.Added
                    }]
                });
            });
        }
        for(let i = 1; i < sources.length; i++) {
            const fromSrc = options.sources[i - 1];
            const toSrc = options.sources[i];
            const to = sources[i];
            const d = diff(from, to);
            if(d.news.length) {
                d.news.forEach(n => {
                    items.push({
                        from : fromSrc.tag || fromSrc.fileName,
                        to : toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Added,
                        path: n
                    });
                    const time = getOrCreateTime(timelines, n);
                    time.changes.push({
                        at: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Added
                    })
                });
            }
            if(d.deps.length) {
                d.deps.forEach(n => {
                    items.push({
                        from : fromSrc.tag || fromSrc.fileName,
                        to : toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Deprecated,
                        path: n
                    });
                    const time = getOrCreateTime(timelines, n);
                    time.changes.push({
                        at: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Deprecated
                    })
                });
            }
            if(d.olds.length) {
                d.olds.forEach(n => {
                    items.push({
                        from : fromSrc.tag || fromSrc.fileName,
                        to : toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Removed,
                        path: n
                    });
                    const time = getOrCreateTime(timelines, n);
                    time.changes.push({
                        at: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Removed
                    })
                });
            }
            // ready next from
            from = to;
        }
        return done({items, timelines});
    } catch(err) {
        // just callback for any block error
        return fail(err);
    }
}