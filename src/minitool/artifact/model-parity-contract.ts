import rawContract from "./model-parity-contract.json";

export type ModelParityGroupName = "earth" | "heaven" | "generals" | "core";

export interface ModelParityGroup {
  readonly nodeIds: readonly string[];
  readonly visualRoles: readonly string[];
}

interface ModelParityContract {
  readonly sourceModel: string;
  readonly referenceImage: {
    readonly path: string;
    readonly width: number;
    readonly height: number;
  };
  readonly nodeIds: readonly string[];
  readonly groups: Record<ModelParityGroupName, ModelParityGroup>;
  readonly budget: {
    readonly triangles: number;
    readonly drawCalls: number;
    readonly textureSize: number;
  };
  readonly runtime: {
    readonly hiddenMeshKeys: readonly string[];
    readonly referenceSurfaceDrawCalls: number;
  };
}

const contract = rawContract as ModelParityContract;

function freezeGroup(group: ModelParityGroup): Readonly<ModelParityGroup> {
  return Object.freeze({
    nodeIds: Object.freeze([...group.nodeIds]),
    visualRoles: Object.freeze([...group.visualRoles]),
  });
}

export const MODEL_PARITY_REFERENCE = Object.freeze({
  path: contract.referenceImage.path,
  width: contract.referenceImage.width,
  height: contract.referenceImage.height,
});

export const MINITOOL_MODEL_NODE_IDS: readonly string[] = Object.freeze([...contract.nodeIds]);

export const MINITOOL_MODEL_GROUPS: Readonly<Record<ModelParityGroupName, Readonly<ModelParityGroup>>> = Object.freeze({
  earth: freezeGroup(contract.groups.earth),
  heaven: freezeGroup(contract.groups.heaven),
  generals: freezeGroup(contract.groups.generals),
  core: freezeGroup(contract.groups.core),
});

export const MODEL_PARITY_BUDGET = Object.freeze({
  triangles: contract.budget.triangles,
  drawCalls: contract.budget.drawCalls,
  textureSize: contract.budget.textureSize,
});

export const MODEL_PARITY_RUNTIME = Object.freeze({
  hiddenMeshKeys: Object.freeze([...contract.runtime.hiddenMeshKeys]),
  referenceSurfaceDrawCalls: contract.runtime.referenceSurfaceDrawCalls,
});
