import {
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLArgumentConfig,
  GraphQLEnumType,
  isEnumType,
  isNonNullType,
  getNullableType,
  getNamedType,
  isListType,
  isScalarType,
  GraphQLType,
} from 'graphql';

import {
  MergeTypeCandidate,
  MergeFieldConfigCandidate,
  MergeInputFieldConfigCandidate,
  TypeMergingOptions,
  ValidationSettings,
  ValidationLevel,
} from './types';

export function validateFieldConsistency<TContext = Record<string, any>>(
  finalFieldConfig: GraphQLFieldConfig<any, any>,
  candidates: Array<MergeFieldConfigCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): void {
  const fieldNamespace = `${candidates[0].type.name}.${candidates[0].fieldName}`;
  const finalFieldNull = isNonNullType(finalFieldConfig.type);

  validateTypeConsistency(
    finalFieldConfig,
    candidates.map(c => c.fieldConfig),
    'field',
    fieldNamespace,
    typeMergingOptions
  );

  if (
    getValidationSettings(fieldNamespace, typeMergingOptions).strictNullComparison &&
    candidates.some(c => finalFieldNull !== isNonNullType(c.fieldConfig.type))
  ) {
    validationMessage(
      `Nullability of field "${fieldNamespace}" does not match across subschemas. Disable typeMergingOptions.validationSettings.strictNullComparison to permit safe divergences.`,
      fieldNamespace,
      typeMergingOptions
    );
  } else if (finalFieldNull && candidates.some(c => !isNonNullType(c.fieldConfig.type))) {
    validationMessage(
      `Canonical definition of field "${fieldNamespace}" is not-null while some subschemas permit null. This will be an automatic error in future versions.`,
      fieldNamespace,
      typeMergingOptions
    );
  }

  const argCandidatesMap: Record<string, Array<GraphQLArgumentConfig>> = Object.create(null);
  candidates.forEach(({ fieldConfig }) => {
    if (fieldConfig.args == null) {
      return;
    }
    Object.entries(fieldConfig.args).forEach(([argName, arg]) => {
      argCandidatesMap[argName] = argCandidatesMap[argName] || [];
      argCandidatesMap[argName].push(arg);
    });
  });

  if (Object.values(argCandidatesMap).some(argCandidates => candidates.length !== argCandidates.length)) {
    validationMessage(
      `Canonical definition of field "${fieldNamespace}" implements inconsistent argument names across subschemas. Input may be filtered from some requests.`,
      fieldNamespace,
      typeMergingOptions
    );
  }

  Object.entries(argCandidatesMap).forEach(([argName, argCandidates]) => {
    if (finalFieldConfig.args == null) {
      return;
    }
    const argNamespace = `${fieldNamespace}.${argName}`;
    const finalArgConfig = finalFieldConfig.args[argName] || argCandidates[argCandidates.length - 1];
    const finalArgType = getNamedType(finalArgConfig.type);
    const finalArgNull = isNonNullType(finalArgConfig.type);

    validateTypeConsistency(finalArgConfig, argCandidates, 'argument', argNamespace, typeMergingOptions);

    if (
      getValidationSettings(argNamespace, typeMergingOptions).strictNullComparison &&
      argCandidates.some(c => finalArgNull !== isNonNullType(c.type))
    ) {
      validationMessage(
        `Nullability of argument "${argNamespace}" does not match across subschemas. Disable typeMergingOptions.validationSettings.strictNullComparison to permit safe divergences.`,
        argNamespace,
        typeMergingOptions
      );
    } else if (!finalArgNull && argCandidates.some(c => isNonNullType(c.type))) {
      validationMessage(
        `Canonical definition of argument "${argNamespace}" permits null while some subschemas require not-null. This will be an automatic error in future versions.`,
        argNamespace,
        typeMergingOptions
      );
    }

    if (isEnumType(finalArgType)) {
      validateInputEnumConsistency(finalArgType, argCandidates, typeMergingOptions);
    }
  });
}

export function validateInputObjectConsistency<TContext = Record<string, any>>(
  fieldInclusionMap: Record<string, number>,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): void {
  Object.entries(fieldInclusionMap).forEach(([fieldName, count]) => {
    if (candidates.length !== count) {
      const namespace = `${candidates[0].type.name}.${fieldName}`;
      validationMessage(
        `Definition of input field "${namespace}" is not implemented by all subschemas. Input may be filtered from some requests.`,
        namespace,
        typeMergingOptions
      );
    }
  });
}

export function validateInputFieldConsistency<TContext = Record<string, any>>(
  finalInputFieldConfig: GraphQLInputFieldConfig,
  candidates: Array<MergeInputFieldConfigCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): void {
  const inputFieldNamespace = `${candidates[0].type.name}.${candidates[0].fieldName}`;
  const inputFieldConfigs = candidates.map(c => c.inputFieldConfig);
  const finalInputFieldType = getNamedType(finalInputFieldConfig.type);
  const finalInputFieldNull = isNonNullType(finalInputFieldConfig.type);

  validateTypeConsistency(
    finalInputFieldConfig,
    inputFieldConfigs,
    'input field',
    inputFieldNamespace,
    typeMergingOptions
  );

  if (
    getValidationSettings(inputFieldNamespace, typeMergingOptions).strictNullComparison &&
    candidates.some(c => finalInputFieldNull !== isNonNullType(c.inputFieldConfig.type))
  ) {
    validationMessage(
      `Nullability of input field "${inputFieldNamespace}" does not match across subschemas. Disable typeMergingOptions.validationSettings.strictNullComparison to permit safe divergences.`,
      inputFieldNamespace,
      typeMergingOptions
    );
  } else if (!finalInputFieldNull && candidates.some(c => isNonNullType(c.inputFieldConfig.type))) {
    validationMessage(
      `Canonical definition of input field "${inputFieldNamespace}" permits null while some subschemas require not-null. This will be an automatic error in future versions.`,
      inputFieldNamespace,
      typeMergingOptions
    );
  }

  if (isEnumType(finalInputFieldType)) {
    validateInputEnumConsistency(finalInputFieldType, inputFieldConfigs, typeMergingOptions);
  }
}

export function validateTypeConsistency<TContext = Record<string, any>>(
  finalElementConfig: GraphQLFieldConfig<any, any> | GraphQLArgumentConfig | GraphQLInputFieldConfig,
  candidates: Array<GraphQLFieldConfig<any, any> | GraphQLArgumentConfig | GraphQLInputFieldConfig>,
  definitionType: string,
  settingNamespace: string,
  typeMergingOptions?: TypeMergingOptions<TContext>
): void {
  const finalNamedType = getNamedType(finalElementConfig.type);
  const finalIsScalar = isScalarType(finalNamedType);
  const finalIsList = hasListType(finalElementConfig.type);

  candidates.forEach(c => {
    if (finalIsList !== hasListType(c.type)) {
      throw new Error(
        `Definitions of ${definitionType} "${settingNamespace}" implement inconsistent list types across subschemas and cannot be merged.`
      );
    }

    const currentNamedType = getNamedType(c.type);

    if (finalNamedType.toString() !== currentNamedType.toString()) {
      const proxiableScalar = !!typeMergingOptions?.validationSettings?.proxiableScalars?.[
        finalNamedType.toString()
      ]?.includes(currentNamedType.toString());
      const bothScalars = finalIsScalar && isScalarType(currentNamedType);
      const permitScalar = proxiableScalar && bothScalars;
      if (proxiableScalar && !bothScalars) {
        throw new Error(`Types ${finalNamedType} and ${currentNamedType} are not proxiable scalars.`);
      }
      if (!permitScalar) {
        validationMessage(
          `Definitions of ${definitionType} "${settingNamespace}" implement inconsistent named types across subschemas. This will be an automatic error in future versions.`,
          settingNamespace,
          typeMergingOptions
        );
      }
    }
  });
}

function hasListType(type: GraphQLType): boolean {
  return isListType(getNullableType(type));
}

export function validateInputEnumConsistency<TContext = Record<string, any>>(
  inputEnumType: GraphQLEnumType,
  candidates: Array<GraphQLArgumentConfig | GraphQLInputFieldConfig>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): void {
  const enumValueInclusionMap: Record<string, number> = Object.create(null);

  candidates.forEach(candidate => {
    const enumType = getNamedType(candidate.type) as GraphQLEnumType;
    if (isEnumType(enumType)) {
      enumType.getValues().forEach(({ value }) => {
        enumValueInclusionMap[value] = enumValueInclusionMap[value] || 0;
        enumValueInclusionMap[value] += 1;
      });
    }
  });

  if (Object.values(enumValueInclusionMap).some(count => candidates.length !== count)) {
    validationMessage(
      `Enum "${inputEnumType.name}" is used as an input with inconsistent values across subschemas. This will be an automatic error in future versions.`,
      inputEnumType.name,
      typeMergingOptions
    );
  }
}

function validationMessage<TContext = Record<string, any>>(
  message: string,
  settingNamespace: string,
  typeMergingOptions?: TypeMergingOptions<TContext>
): void {
  const override = `typeMergingOptions.validationScopes['${settingNamespace}'].validationLevel`;
  const settings = getValidationSettings(settingNamespace, typeMergingOptions);

  switch (settings.validationLevel ?? ValidationLevel.Warn) {
    case ValidationLevel.Off:
      return;
    case ValidationLevel.Error:
      throw new Error(
        `${message} If this is intentional, you may disable this error by setting ${override} = "warn|off"`
      );
    default:
      console.warn(`${message} To disable this warning or elevate it to an error, set ${override} = "error|off"`);
  }
}

function getValidationSettings<TContext = Record<string, any>>(
  settingNamespace: string,
  typeMergingOptions?: TypeMergingOptions<TContext>
): ValidationSettings {
  return {
    ...(typeMergingOptions?.validationSettings ?? {}),
    ...(typeMergingOptions?.validationScopes?.[settingNamespace] ?? {}),
  };
}
