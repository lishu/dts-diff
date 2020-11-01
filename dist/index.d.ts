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
export declare enum DiffItemKind {
    /** New Item Added */
    Added = 0,
    /** Item Changed */
    Changed = 1,
    /** Item Removed */
    Removed = 2,
    /** Item has comment Deprecated */
    Deprecated = 3
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
    (result?: IDiffResult, err?: any): void;
}
/** Parser Options */
export interface IDiffParserOptions {
    /** All need handle sources */
    sources: IDiffSource[];
    /** Make first source file all items in timeline added */
    timelineFirstAddAllFirst?: boolean;
}
/**
 * Load a local file as `IDiffSource`.
 * @param fileName The .d.ts filename will loaded.
 * @param tag DiffSource tag
 * @returns `Promise` of `IDiffSource`.
 */
export declare function loadSource(fileName: string, tag?: string): Promise<IDiffSource>;
export declare function parse(options: IDiffParserOptions): Promise<IDiffResult>;
export declare function parse(options: IDiffParserOptions, callback: IDiffCallback): void;
