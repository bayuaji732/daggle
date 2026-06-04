# Kubeflow Integration Plan (Dataset Storage)

This document outlines the exact "homework" required to transition Daggle's local Docker dataset sharing into a production-grade Kubernetes/Kubeflow environment with zero manual configuration for the end-users.

## User Review Required
> [!NOTE]
> All open questions resolved. Target environment:
> - **Storage**: CephFS (RWX)
> - **Notebooks**: Standard Kubeflow Notebooks UI
> - **Authentication**: Daggle's internal Keycloak (Kubeflow will federate to Daggle)

## The Implementation Strategy

### 1. Provision the Shared Storage (PVC)
Instead of Docker volumes or Host Bind mounts, Daggle will rely on a Kubernetes Persistent Volume Claim.

#### [NEW] [daggle-datasets-pvc.yaml]
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: daggle-datasets-pvc
  namespace: kubeflow-user # Or wherever Daggle is deployed
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 500Gi
  storageClassName: cephfs
```

### 2. Daggle Backend & Worker Deployment
When Daggle is deployed via Helm or raw Kubernetes manifests, the backend and Celery worker will mount this PVC natively.

#### [NEW] [daggle-deployment.yaml]
```yaml
# Snippet of Daggle Worker Deployment
volumes:
  - name: shared-datasets
    persistentVolumeClaim:
      claimName: daggle-datasets-pvc
containers:
  - name: celery-worker
    volumeMounts:
      - name: shared-datasets
        mountPath: /extracted_datasets
```
*Result: Every time Daggle extracts a dataset, it gets written directly to the shared network drive.*

### 3. Kubeflow Notebook Integration (The Magic)
To achieve the exact same isolation we built locally (mounting only the specific `slug/version`), we will use Kubernetes `subPath` combined with Kubeflow's **PodDefaults**.

Kubeflow allows you to define a `PodDefault` which automatically injects volumes and environment variables into Notebooks that request them.

#### [NEW] [kubeflow-poddefault.yaml]
If integrating via Kubeflow Notebooks UI, the user selects the dataset, and a mutating webhook or operator injects this volume:

```yaml
volumeMounts:
  - name: daggle-shared-pvc
    mountPath: /home/jovyan/input
    # The crucial subPath feature that Docker Compose lacks!
    subPath: {{ dataset.slug }}/{{ dataset.version }} 
    readOnly: true
volumes:
  - name: daggle-shared-pvc
    persistentVolumeClaim:
      claimName: daggle-datasets-pvc
```

### 4. Kubeflow Auth Integration (OIDC)
Since Daggle's Keycloak is the primary source of truth for the platform, we will configure Kubeflow to federate **to** Daggle.

- Keep Daggle's local Keycloak running.
- In Kubeflow's Dex configuration (`dex-config` ConfigMap), add Daggle's Keycloak as an OIDC connector.
- When a user logs into Kubeflow, they click "Login with Daggle", seamlessly tying their Kubeflow namespace to their Daggle identity.

## Verification Plan
1. Deploy a local lightweight Kubernetes cluster (e.g., `minikube` or `k3d`).
2. Install the NFS CSI driver to simulate ReadWriteMany storage.
3. Apply the PVC and Daggle deployments.
4. Manually spawn a test Pod simulating a Kubeflow notebook using the `subPath` configuration to verify exact Kaggle-style isolation.
