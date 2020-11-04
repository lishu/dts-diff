"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.loadSource = exports.DiffItemKind = void 0;
const typescript_1 = require("typescript");
const fs_1 = require("fs");
/** The Diff Kind */
var DiffItemKind;
(function (DiffItemKind) {
    /** New Item Added */
    DiffItemKind[DiffItemKind["Added"] = 0] = "Added";
    /** Item Changed */
    DiffItemKind[DiffItemKind["Changed"] = 1] = "Changed";
    /** Item Removed */
    DiffItemKind[DiffItemKind["Removed"] = 2] = "Removed";
    /** Item has comment Deprecated */
    DiffItemKind[DiffItemKind["Deprecated"] = 3] = "Deprecated";
})(DiffItemKind = exports.DiffItemKind || (exports.DiffItemKind = {}));
function optionValid(options) {
    if (options.sources.length < 2) {
        throw new Error('Options error! `options.sources` should less has two items.');
    }
}
/**
 * Load a local file as `IDiffSource`.
 * @param fileName The .d.ts filename will loaded.
 * @param tag DiffSource tag
 * @returns `Promise` of `IDiffSource`.
 */
function loadSource(fileName, tag) {
    return new Promise((resolve, reject) => {
        fs_1.readFile(fileName, { encoding: 'utf-8' }, (err, data) => {
            if (err) {
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
exports.loadSource = loadSource;
function getFullname(sign, parent) {
    if (parent) {
        return parent.fullname + '.' + sign;
    }
    return sign;
}
function findOrAppend(items, kind, sign, node, parent) {
    let fullname = getFullname(sign, parent);
    let item = items.find(p => p.kind == kind && p.fullname == fullname);
    if (!item) {
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
function handleSyntaxList(items, s, mod, modItem, syntaxList) {
    for (let child of syntaxList._children) {
        switch (child.kind) {
            case typescript_1.SyntaxKind.SyntaxList:
                handleSyntaxList(items, s, mod, modItem, child);
                break;
            case typescript_1.SyntaxKind.ModuleDeclaration:
                handleModuleDec(items, s, child, modItem);
                break;
            case typescript_1.SyntaxKind.InterfaceDeclaration:
                handleInterfaceDec(items, s, child, modItem);
                break;
            case typescript_1.SyntaxKind.ClassDeclaration:
                handleClassDec(items, s, child, modItem);
                break;
            case typescript_1.SyntaxKind.FunctionDeclaration:
                handleFunctionDec(items, s, child, modItem);
                break;
            case typescript_1.SyntaxKind.EnumDeclaration:
                handleEnumDec(items, s, child, modItem);
                break;
            case typescript_1.SyntaxKind.TypeAliasDeclaration:
                handleTypeAliasDec(items, s, child, modItem);
                break;
            case typescript_1.SyntaxKind.FirstStatement:
                handleFirstStatementDec(items, s, child, modItem);
                break;
            default:
                console.log('handleSyntaxList kind', child.kind);
                break;
        }
    }
}
function handleModuleDec(items, s, mod, parent) {
    const name = mod.name.getText(s);
    // console.debug('处理模块 ' + name);
    const modItem = findOrAppend(items, typescript_1.SyntaxKind.ModuleDeclaration, name, mod, parent);
    if (mod.body) {
        let children = mod.body.getChildren(s);
        for (let child of children) {
            switch (child.kind) {
                case typescript_1.SyntaxKind.SyntaxList:
                    handleSyntaxList(items, s, mod, modItem, child);
                    break;
                case typescript_1.SyntaxKind.OpenBraceToken:
                case typescript_1.SyntaxKind.CloseBraceToken:
                    break;
                default:
                    console.log('handleModuleDec kind', child.kind);
                    break;
            }
        }
    }
}
function handleEnumDec(items, s, enu, parent) {
    const name = enu.name.getText(s);
    // console.debug('处理枚举 ' + name);
    const item = findOrAppend(items, typescript_1.SyntaxKind.EnumDeclaration, name, enu, parent);
    enu.members.forEach(m => {
        let enumItem = m.name.getText(s);
        findOrAppend(items, typescript_1.SyntaxKind.EnumMember, enumItem, m, item);
    });
}
function handleTypeAliasDec(items, s, typ, parent) {
    const name = typ.name.getText(s);
    // console.debug('处理别名 ' + name);
    const item = findOrAppend(items, typescript_1.SyntaxKind.TypeAliasDeclaration, name, typ, parent);
}
function handleVariableDec(items, s, varDec, parent) {
    const name = varDec.name.getText(s);
    findOrAppend(items, typescript_1.SyntaxKind.VariableDeclaration, name, varDec, parent);
}
function handleVariableDeclarationList(items, s, varDecList, parent) {
    varDecList.declarations.forEach(dec => handleVariableDec(items, s, dec, parent));
}
function handleFirstStatementDec(items, s, st, parent) {
    st.forEachChild(c => {
        switch (c.kind) {
            case typescript_1.SyntaxKind.VariableDeclarationList:
                handleVariableDeclarationList(items, s, c, parent);
                break;
            default:
                console.log('c', c.kind);
                break;
        }
    }, cs => {
        cs.forEach(c => {
            switch (c.kind) {
                case typescript_1.SyntaxKind.ExportKeyword:
                    // console.log(c.getFullText(s));
                    // console.log(ts.getJSDocTags(c).map(t=>t.tagName));
                    break;
                default:
                    console.log('cc', c.kind);
                    break;
            }
        });
    });
}
function isDeprecated(s, d) {
    const fullText = d.getFullText(s);
    return (fullText && fullText.includes('@deprecated'));
}
function handleInterfaceDec(items, s, inf, parent) {
    const name = inf.name.getText(s);
    // console.debug('处理接口 ' + name);
    const item = findOrAppend(items, typescript_1.SyntaxKind.InterfaceDeclaration, name, inf, parent);
    inf.members.forEach(m => {
        if (m.name) {
            let memberName = m.name.getText(s);
            findOrAppend(items, m.kind, memberName, m, item).deprecated = isDeprecated(s, m);
            return;
        }
        if (m.kind == typescript_1.SyntaxKind.CallSignature || m.kind == typescript_1.SyntaxKind.IndexSignature) {
            findOrAppend(items, m.kind, m.getText(s), m, item);
            return;
        }
        console.warn(m.kind);
    });
}
function handleClassDec(items, s, cls, parent) {
    const name = cls.name.getText(s);
    // console.debug('处理类型 ' + name);
    const item = findOrAppend(items, typescript_1.SyntaxKind.ClassDeclaration, name, cls, parent);
    cls.members.forEach(m => {
        if (m.name) {
            let memberName = m.name.getText(s);
            findOrAppend(items, m.kind, memberName, m, item).deprecated = isDeprecated(s, m);
            return;
        }
        if (m.kind == typescript_1.SyntaxKind.CallSignature || m.kind == typescript_1.SyntaxKind.IndexSignature || m.kind == typescript_1.SyntaxKind.Constructor) {
            findOrAppend(items, m.kind, m.getText(s), m, item);
            return;
        }
        console.warn(m.kind);
    });
}
function handleFunctionDec(items, s, fun, parent) {
    const name = fun.name.getText(s);
    // console.debug('处理函数 ' + name);
    const item = findOrAppend(items, typescript_1.SyntaxKind.FunctionDeclaration, name, fun, parent);
}
function getDec(a) {
    let items = [];
    a.statements.forEach(statement => {
        switch (statement.kind) {
            case typescript_1.SyntaxKind.ModuleDeclaration:
                handleModuleDec(items, a, statement);
                break;
            case typescript_1.SyntaxKind.InterfaceDeclaration:
                handleInterfaceDec(items, a, statement);
                break;
            default:
                console.warn(`未处理语法类 ${statement.kind}`);
        }
    });
    items = items.sort((a, b) => a.fullname.localeCompare(b.fullname));
    return items;
}
function logItems(items) {
    items = items.sort((a, b) => a.fullname.localeCompare(b.fullname));
    for (let item of items) {
        console.log(item.kind, item.fullname);
    }
}
function diff(a, b) {
    const news = [];
    const olds = [];
    const deps = [];
    const adec = getDec(a);
    const bdec = getDec(b);
    let aidx = 0;
    let bidx = 0;
    while (aidx < adec.length && bidx < bdec.length) {
        let an = adec[aidx].fullname;
        let bn = bdec[bidx].fullname;
        let cs = an.localeCompare(bn);
        if (cs == 0) {
            if (bdec[bidx].deprecated && !adec[aidx].deprecated) {
                deps.push(bdec[bidx++].fullname);
            }
            aidx++;
            bidx++;
        }
        else if (cs > 0) {
            news.push(bdec[bidx++].fullname);
        }
        else {
            olds.push(adec[aidx++].fullname);
        }
    }
    return { news, olds, deps };
}
function getOrCreateTime(timelines, path) {
    let timeItem = timelines.find(t => t.path === path);
    if (!timeItem) {
        timeItem = {
            path,
            changes: []
        };
        timelines.push(timeItem);
    }
    return timeItem;
}
function parse(options, callback) {
    const done = callback ? r => callback(r) : r => Promise.resolve(r);
    const fail = callback ? e => callback(undefined, e) : e => Promise.reject(e);
    try {
        optionValid(options);
        const sources = options.sources.map(src => typescript_1.createSourceFile(src.fileName, src.content, typescript_1.ScriptTarget.Latest, false, typescript_1.ScriptKind.TS));
        const items = [];
        const timelines = [];
        let from = sources[0];
        if (options.timelineFirstAddAllFirst) {
            const at = options.sources[0].tag || options.sources[0].fileName;
            getDec(sources[0]).forEach(d => {
                timelines.push({
                    path: d.fullname,
                    changes: [{
                            at,
                            kind: d.deprecated ? DiffItemKind.Deprecated : DiffItemKind.Added
                        }]
                });
            });
        }
        for (let i = 1; i < sources.length; i++) {
            const fromSrc = options.sources[i - 1];
            const toSrc = options.sources[i];
            const to = sources[i];
            const d = diff(from, to);
            if (d.news.length) {
                d.news.forEach(n => {
                    items.push({
                        from: fromSrc.tag || fromSrc.fileName,
                        to: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Added,
                        path: n
                    });
                    const time = getOrCreateTime(timelines, n);
                    time.changes.push({
                        at: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Added
                    });
                });
            }
            if (d.deps.length) {
                d.deps.forEach(n => {
                    items.push({
                        from: fromSrc.tag || fromSrc.fileName,
                        to: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Deprecated,
                        path: n
                    });
                    const time = getOrCreateTime(timelines, n);
                    time.changes.push({
                        at: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Deprecated
                    });
                });
            }
            if (d.olds.length) {
                d.olds.forEach(n => {
                    items.push({
                        from: fromSrc.tag || fromSrc.fileName,
                        to: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Removed,
                        path: n
                    });
                    const time = getOrCreateTime(timelines, n);
                    time.changes.push({
                        at: toSrc.tag || toSrc.fileName,
                        kind: DiffItemKind.Removed
                    });
                });
            }
            // ready next from
            from = to;
        }
        return done({ items, timelines });
    }
    catch (err) {
        // just callback for any block error
        return fail(err);
    }
}
exports.parse = parse;
//# sourceMappingURL=index.js.map