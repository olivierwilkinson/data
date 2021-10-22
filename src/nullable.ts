import { debug } from 'debug'
import { invariant } from 'outvariant'
import {
  Entity,
  KeyType,
  ModelDictionary,
  Value,
  ModelValueType,
} from './glossary'
import { definePropertyAtPath } from './utils/definePropertyAtPath'
import { Relation, RelationKind } from './relations/Relation'

const log = debug('relation')

export type NullableGetter<ValueType extends ModelValueType> =
  () => ValueType | null

export type NullableOneOf<ModelName extends KeyType> = NullableRelation<
  RelationKind.OneOf,
  ModelName,
  any
>
export type NullableManyOf<ModelName extends KeyType> = NullableRelation<
  RelationKind.ManyOf,
  ModelName,
  any
>

export class NullableProperty<ValueType extends ModelValueType> {
  public getValue: NullableGetter<ValueType>

  constructor(getter: NullableGetter<ValueType>) {
    this.getValue = getter
  }
}

export class NullableRelation<
  Kind extends RelationKind = any,
  ModelName extends KeyType = any,
  Dictionary extends ModelDictionary = any,
  ReferenceType = Kind extends RelationKind.OneOf
    ? Value<Dictionary[ModelName], Dictionary> | null
    : Value<Dictionary[ModelName], Dictionary>[] | null,
> extends Relation<Kind, ModelName, Dictionary, ReferenceType> {
  public resolveWith(
    entity: Entity<Dictionary, string>,
    refs: ReferenceType | null,
  ): void {
    if (refs) {
      return super.resolveWith(entity, refs)
    }

    invariant(
      this.source,
      'Failed to resolve a "%s" relational property to "%s": relation has not been applied.',
      this.kind,
      this.target.modelName,
    )

    log(
      'resolving a "%s" relational property to "%s" on "%s.%s" ("%s")',
      this.kind,
      this.target.modelName,
      this.source.modelName,
      this.source.propertyPath,
      entity[this.source.primaryKey],
    )
    log('this relation resolves with null')

    definePropertyAtPath(entity, this.source.propertyPath, {
      // Mark the property as enumerable so it gets listed
      // like a regular property on the entity.
      enumerable: true,
      // Mark the property as configurable so it could be re-defined
      // when updating it during the entity update ("update"/"updateMany").
      configurable: true,
      get: () => {
        log(
          'GET "%s.%s" on "%s" ("%s")',
          this.source.modelName,
          this.source.propertyPath,
          this.source.modelName,
          entity[this.source.primaryKey],
          this,
        )

        log(
          'resolved "%s" relation at "%s.%s" ("%s") to null',
          this.kind,
          this.source.modelName,
          this.source.propertyPath,
          entity[this.source.primaryKey],
        )

        return null
      },
    })
  }
}

export function nullable<ValueType extends ModelValueType>(
  value: NullableGetter<ValueType>,
): NullableProperty<ValueType>

export function nullable<ValueType extends Relation<any, any, any>>(
  value: ValueType,
): ValueType extends Relation<infer Kind, infer ModelName, any>
  ? Kind extends RelationKind.ManyOf
    ? NullableManyOf<ModelName>
    : NullableOneOf<ModelName>
  : never

export function nullable(
  value: NullableGetter<ModelValueType> | Relation<any, any, any>,
) {
  if (typeof value === 'function') {
    return new NullableProperty(value)
  }

  return new NullableRelation({
    kind: value.kind,
    attributes: value.attributes,
    to: value.target.modelName,
  })
}
