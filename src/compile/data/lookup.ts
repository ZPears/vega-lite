import {isString, toSet} from 'vega-util';
import * as log from '../../log';
import {LookupTransform} from '../../transform';
import {hash, StringSet} from '../../util';
import {VgLookupTransform} from '../../vega.schema';
import {Model} from '../model';
import {DataFlowNode, OutputNode, TransformNode} from './dataflow';
import {SourceNode} from './source';

export class LookupNode extends TransformNode {
  constructor(parent: DataFlowNode, public readonly transform: LookupTransform, public readonly secondary: string) {
    super(parent);
  }

  public static make(parent: DataFlowNode, model: Model, transform: LookupTransform, counter: number) {
    const sources = model.component.data.sources;
    const s = new SourceNode(transform.from.data);
    let fromSource = sources[s.hash()];
    if (!fromSource) {
      sources[s.hash()] = s;
      fromSource = s;
    }

    const fromOutputName = model.getName(`lookup_${counter}`);
    const fromOutputNode = new OutputNode(
      fromSource,
      fromOutputName,
      'lookup',
      model.component.data.outputNodeRefCounts
    );

    model.component.data.outputNodes[fromOutputName] = fromOutputNode;

    return new LookupNode(parent, transform, fromOutputNode.getSource());
  }

  public producedFields(): StringSet {
    return toSet(
      this.transform.from.fields || (this.transform.as instanceof Array ? this.transform.as : [this.transform.as])
    );
  }

  public hash() {
    return `Lookup ${hash({transform: this.transform, secondary: this.secondary})}`;
  }

  public assemble(): VgLookupTransform {
    let foreign: Partial<VgLookupTransform>;

    if (this.transform.from.fields) {
      // lookup a few fields and add create a flat output
      foreign = {
        values: this.transform.from.fields,
        ...(this.transform.as ? {as: this.transform.as instanceof Array ? this.transform.as : [this.transform.as]} : {})
      };
    } else {
      // lookup full record and nest it
      let asName = this.transform.as;
      if (!isString(asName)) {
        log.warn(log.message.NO_FIELDS_NEEDS_AS);
        asName = '_lookup';
      }

      foreign = {
        as: [asName]
      };
    }

    return {
      type: 'lookup',
      from: this.secondary,
      key: this.transform.from.key,
      fields: [this.transform.lookup],
      ...foreign,
      ...(this.transform.default ? {default: this.transform.default} : {})
    };
  }
}
