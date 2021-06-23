export interface PropertyTree {
  [property: string]: null | PropertyTree;
}

export interface ParsedMergeArgsExpr {
  args: Record<string, any>;
  usedProperties: PropertyTree;
  mappingInstructions?: Array<MappingInstruction>;
  expansions?: Array<Expansion>;
}

export interface MappingInstruction {
  destinationPath: Array<string>;
  sourcePath: Array<string>;
}

export interface Expansion {
  valuePath: Array<string>;
  value: any;
  mappingInstructions: Array<MappingInstruction>;
}

export type VariablePaths = Record<string, Array<string | number>>;

export interface StitchingDirectivesOptions {
  keyDirectiveName?: string;
  computedDirectiveName?: string;
  mergeDirectiveName?: string;
  canonicalDirectiveName?: string;
  pathToDirectivesInExtensions?: Array<string>;
}

type Complete<T> = {
  [P in keyof Required<T>]: Exclude<Pick<T, P> extends Required<Pick<T, P>> ? T[P] : T[P] | undefined, undefined>;
};

export type StitchingDirectivesFinalOptions = Complete<StitchingDirectivesOptions>;

export interface MergedTypeResolverInfo extends ParsedMergeArgsExpr {
  fieldName: string;
  returnsList: boolean;
}
