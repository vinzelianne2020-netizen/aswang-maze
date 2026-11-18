#!/usr/bin/env python3
"""Procedural Aswang (Philippine folklore monster) -> animated GLB. No external assets."""
import numpy as np, json, struct, math, sys
from math import sin, cos, pi

rng = np.random.default_rng(13)

# ---------------------------------------------------------------- math helpers
def norm(v):
    v = np.asarray(v, float)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-9)

def vnormals(P, F):
    fn = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, F[:, k], fn)
    return norm(N)

def noise(P, f, seed=0.0):
    x, y, z = (P * f).T
    n = (np.sin(x * 1.7 + seed) * np.sin(y * 2.3 + 1.3 * np.sin(z * 1.1))
         + np.sin(z * 3.1 + y * 0.7 + seed) * np.sin(x * 2.9 + 2)
         + 0.5 * np.sin(x * 7.3 + y * 6.1 + z * 5.3)) / 2.2
    return np.clip(n, -1, 1)

def rot_to(d):
    z = norm(d)
    a = np.array([0, 1, 0.]) if abs(z[1]) < 0.95 else np.array([1, 0, 0.])
    x = norm(np.cross(a, z)); y = np.cross(z, x)
    return np.stack([x, y, z], 1)

def Rz(a):
    c, s = cos(a), sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def catmull(pts, sub):
    pts = np.asarray(pts, float)
    n = len(pts)
    if n == 2:
        t = np.linspace(0, 1, sub + 1)[:, None]
        return pts[0] * (1 - t) + pts[1] * t, np.linspace(0, 1, sub + 1)
    P = np.vstack([2 * pts[0] - pts[1], pts, 2 * pts[-1] - pts[-2]])
    out, u = [], []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, sub, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
            u.append((i - 1 + t) / (n - 1))
    out.append(pts[-1]); u.append(1.0)
    return np.array(out), np.array(u)

def tube(pts, radii, sides=10, sub=4, ext=0.0, ref=(1, 0, 0)):
    pts = np.asarray(pts, float); radii = np.asarray(radii, float)
    if radii.ndim == 1:
        radii = np.stack([radii, radii], 1)
    if ext > 0:
        d0 = norm(pts[0] - pts[1]); d1 = norm(pts[-1] - pts[-2])
        pts = np.vstack([pts[0] + d0 * ext, pts, pts[-1] + d1 * ext])
        radii = np.vstack([radii[0], radii, radii[-1]])
    c, u = catmull(pts, sub)
    R = np.stack([np.interp(u, np.linspace(0, 1, len(radii)), radii[:, k]) for k in range(2)], 1)
    T = norm(np.gradient(c, axis=0))
    r = np.asarray(ref, float)
    n0 = r - T[0] * np.dot(r, T[0])
    if np.linalg.norm(n0) < 1e-4:
        r = np.array([0, 1., 0]); n0 = r - T[0] * np.dot(r, T[0])
    nrm = norm(n0)
    ring = np.linspace(0, 2 * pi, sides, endpoint=False)
    V = []
    for i in range(len(c)):
        nrm = nrm - T[i] * np.dot(nrm, T[i]); nrm = norm(nrm)
        b = np.cross(T[i], nrm)
        for th in ring:
            V.append(c[i] + nrm * R[i, 0] * cos(th) + b * R[i, 1] * sin(th))
    V = np.array(V)
    F = []
    for i in range(len(c) - 1):
        for j in range(sides):
            j2 = (j + 1) % sides
            a, b_, c_, d_ = i * sides + j, i * sides + j2, (i + 1) * sides + j, (i + 1) * sides + j2
            F += [(a, b_, c_), (b_, d_, c_)]
    n = len(V)
    V = np.vstack([V, c[0], c[-1]])
    for j in range(sides):
        j2 = (j + 1) % sides
        F.append((n, j2, j))
        F.append((n + 1, (len(c) - 1) * sides + j, (len(c) - 1) * sides + j2))
    return V, np.array(F, np.uint32)

def ellipsoid(ctr, rad, R=None, seg=14, rings=9):
    R = np.eye(3) if R is None else R
    U = [[0, 0, -1.]]
    for k in range(1, rings):
        ph = pi * k / rings
        for j in range(seg):
            th = 2 * pi * j / seg
            U.append([sin(ph) * cos(th), sin(ph) * sin(th), -cos(ph)])
    U.append([0, 0, 1.])
    U = np.array(U)
    F = []
    for j in range(seg):
        F.append((0, 1 + j, 1 + (j + 1) % seg))
    for k in range(rings - 2):
        for j in range(seg):
            a = 1 + k * seg + j; b = 1 + k * seg + (j + 1) % seg
            c = a + seg; d = b + seg
            F += [(a, c, b), (b, c, d)]
    top = len(U) - 1
    for j in range(seg):
        F.append((top, 1 + (rings - 2) * seg + (j + 1) % seg, 1 + (rings - 2) * seg + j))
    F = np.array(F, np.uint32)
    cen = U[F].mean(1)
    fn = np.cross(U[F[:, 1]] - U[F[:, 0]], U[F[:, 2]] - U[F[:, 0]])
    flip = (fn * cen).sum(1) < 0
    F[flip] = F[flip][:, ::-1]
    P = np.asarray(ctr, float) + (U * np.asarray(rad, float)) @ R.T
    return P, F

# ---------------------------------------------------------------- skeleton
J = {
    'Hips': (0, 1.0, 0), 'Spine': (0, 1.2, 0.05), 'Chest': (0, 1.5, 0.2), 'Neck': (0, 1.85, 0.4),
    'Head': (0, 1.98, 0.58), 'Jaw': (0, 1.95, 0.68), 'Hair': (0, 2.1, 0.56), 'Gut': (0, 1.25, 0.18),
    'Tail0': (0, 0.98, -0.1), 'Tail1': (0, 0.8, -0.55), 'Tail2': (0, 0.55, -1.0), 'Tail3': (0, 0.4, -1.5),
}
PARENT = {'Hips': 'Root', 'Spine': 'Hips', 'Chest': 'Spine', 'Neck': 'Chest', 'Head': 'Neck', 'Jaw': 'Head',
          'Hair': 'Head', 'Gut': 'Spine', 'Tail0': 'Hips', 'Tail1': 'Tail0', 'Tail2': 'Tail1', 'Tail3': 'Tail2'}
SIDES = ((1, 'L'), (-1, 'R'))
for s, n in SIDES:
    J['Shoulder' + n] = (s * 0.33, 1.75, 0.3); PARENT['Shoulder' + n] = 'Chest'
    J['Elbow' + n] = (s * 0.5, 1.27, 0.34);    PARENT['Elbow' + n] = 'Shoulder' + n
    J['Wrist' + n] = (s * 0.55, 0.62, 0.52);   PARENT['Wrist' + n] = 'Elbow' + n
    J['Thigh' + n] = (s * 0.18, 0.97, 0.0);    PARENT['Thigh' + n] = 'Hips'
    J['Knee' + n] = (s * 0.2, 0.55, 0.28);     PARENT['Knee' + n] = 'Thigh' + n
    J['Ankle' + n] = (s * 0.2, 0.3, -0.1);     PARENT['Ankle' + n] = 'Knee' + n
    J['Wing' + n] = (s * 0.15, 1.72, -0.02);   PARENT['Wing' + n] = 'Chest'
TONGUE = [(0, 1.905 - 0.2 * i, 0.86 + 0.02 * i) for i in range(7)]
for i in range(6):
    J['Tongue%d' % i] = TONGUE[i]
    PARENT['Tongue%d' % i] = 'Jaw' if i == 0 else 'Tongue%d' % (i - 1)
J = {k: np.array(v, float) for k, v in J.items()}

# ---------------------------------------------------------------- materials
MATS = {
    'skin':     dict(c=(0.36, 0.33, 0.33), r=0.8, m=0.0),
    'bone':     dict(c=(0.72, 0.67, 0.54), r=0.6, m=0.0),
    'teeth':    dict(c=(0.82, 0.78, 0.62), r=0.4, m=0.0),
    'claw':     dict(c=(0.10, 0.09, 0.08), r=0.3, m=0.15),
    'eye':      dict(c=(0, 0, 0), r=0.2, m=0.0, e=(1.0, 0.1, 0.02), es=12.0),
    'socket':   dict(c=(0.01, 0.005, 0.005), r=1.0, m=0.0),
    'tongue':   dict(c=(0.5, 0.06, 0.08), r=0.22, m=0.0),
    'mouth':    dict(c=(0.25, 0.02, 0.03), r=0.4, m=0.0),
    'membrane': dict(c=(0.17, 0.09, 0.10), r=0.65, m=0.0, ds=True),
    'hair':     dict(c=(0.03, 0.03, 0.035), r=0.55, m=0.0),
    'gut':      dict(c=(0.6, 0.14, 0.17), r=0.18, m=0.0),
}
MAT_ORDER = list(MATS)

PARTS = {}  # (joint, mat) -> dict(P,F,C) in world space

def add(joint, mat, geo, amp=0.0, freq=6.0, tint=(1, 1, 1), seed=0.0, shade=0.5):
    P, F = geo
    P = np.asarray(P, float)
    if amp:
        N = vnormals(P, F)
        P = P + N * (amp * noise(P, freq, seed))[:, None]
    n01 = noise(P, freq * 2.3, seed + 5) * 0.5 + 0.5
    C = np.asarray(tint, float)[None] * (1 - shade * 0.5 + shade * 0.6 * n01)[:, None]
    d = PARTS.setdefault((joint, mat), dict(P=[], F=[], C=[], n=0))
    d['P'].append(P); d['C'].append(np.clip(C, 0, 1)); d['F'].append(F.astype(np.uint32) + d['n']); d['n'] += len(P)

def claw(joint, base, direction, length, r, curl=0.35, sides=5):
    base = np.asarray(base, float); d = norm(direction)
    down = np.array([0, -1., 0])
    mid = base + d * length * 0.5 + down * curl * length * 0.15
    tip = base + d * length + down * curl * length * 0.5
    add(joint, 'claw', tube([base, mid, tip], [r, r * 0.65, 0.0012], sides=sides, sub=3))

# ---------------------------------------------------------------- torso profile
TY = np.array([0.97, 1.2, 1.5, 1.7, 1.85])
TZ = np.array([-0.02, 0.05, 0.2, 0.31, 0.4])
TA = np.array([0.18, 0.15, 0.19, 0.22, 0.10])
TB = np.array([0.12, 0.10, 0.13, 0.14, 0.08])
prof = lambda y: (np.interp(y, TY, TZ), np.interp(y, TY, TA), np.interp(y, TY, TB))
skin_t = (0.95, 0.9, 0.92)

# pelvis / spine / chest / neck
add('Hips', 'skin', tube([(0, 0.97, -0.02), (0, 1.2, 0.05)], [(0.18, 0.12), (0.15, 0.10)], sides=14, sub=4, ext=0.03), amp=0.006, tint=skin_t)
add('Spine', 'skin', tube([(0, 1.2, 0.05), (0, 1.5, 0.2)], [(0.15, 0.10), (0.19, 0.13)], sides=14, sub=5, ext=0.03), amp=0.006, tint=skin_t, seed=1)
add('Chest', 'skin', tube([(0, 1.5, 0.2), (0, 1.7, 0.31), (0, 1.85, 0.4)], [(0.19, 0.13), (0.22, 0.14), (0.10, 0.08)], sides=14, sub=5, ext=0.03), amp=0.006, tint=skin_t, seed=2)
add('Neck', 'skin', tube([(0, 1.85, 0.4), (0, 1.98, 0.58)], [(0.075, 0.07), (0.07, 0.065)], sides=10, sub=3, ext=0.03), amp=0.004, tint=skin_t, seed=3)

# exposed ribcage
for k in range(7):
    y = 1.42 + 0.05 * k
    zc, a, b = prof(y)
    a = a * 1.02 + 0.009; b = b * 1.02 + 0.009
    for sx in (-1, 1):
        phis = np.linspace(0.28, 2.45, 9)
        pts = [(sx * a * sin(p), y - 0.035 * cos(p) - 0.01 * k * 0 , zc + b * cos(p)) for p in phis]
        rr = [0.007 + 0.005 * sin(pi * i / 8) for i in range(9)]
        add('Chest', 'bone', tube(pts, rr, sides=6, sub=2), amp=0.002, freq=20, tint=(1, 0.95, 0.9))
zc, a, b = prof(1.74); zc2, a2, b2 = prof(1.45)
add('Chest', 'bone', tube([(0, 1.74, zc + b + 0.008), (0, 1.45, zc2 + b2 + 0.008)], [0.014, 0.011], sides=6, sub=4))
for s, n in SIDES:
    add('Chest', 'bone', tube([(0, 1.79, 0.45), (s * 0.17, 1.82, 0.4), (s * 0.31, 1.78, 0.33)], [0.013, 0.012, 0.012], sides=6, sub=3))
    add('Shoulder' + n, 'skin', ellipsoid((s * 0.33, 1.75, 0.3), (0.095, 0.08, 0.09)), amp=0.004, tint=skin_t)
# back spikes
for y in np.arange(1.25, 1.82, 0.055):
    zc, a, b = prof(y)
    base = np.array([0, y, zc - b + 0.004])
    add('Chest' if y >= 1.5 else 'Spine', 'bone',
        tube([base, base + (0, 0.025, -0.03), base + (0, 0.065 + 0.03 * sin(y * 20), -0.075)], [0.017, 0.011, 0.001], sides=6, sub=2))

# belly wound + entrails
add('Spine', 'gut', ellipsoid((0, 1.27, 0.185), (0.06, 0.1, 0.03)), amp=0.006, freq=25)
for i, x0 in enumerate((-0.04, -0.015, 0.015, 0.04)):
    pts = [(x0, 1.26, 0.2), (x0 * 1.6, 1.06, 0.27), (x0 * 2.4 + 0.02 * (-1) ** i, 0.86, 0.25 + 0.02 * i),
           (x0 * 1.6, 0.64, 0.3), (x0 * 2.2, 0.5 - 0.04 * i, 0.28)]
    add('Gut', 'gut', tube(pts, [0.02, 0.03, 0.021, 0.029, 0.017], sides=8, sub=6), amp=0.003, freq=30, seed=i)

# ---------------------------------------------------------------- head
add('Head', 'skin', ellipsoid((0, 2.03, 0.66), (0.115, 0.13, 0.17), seg=18, rings=12), amp=0.006, freq=9, tint=(0.95, 0.92, 0.9))
add('Head', 'skin', ellipsoid((0, 1.98, 0.84), (0.068, 0.062, 0.13), seg=14, rings=10), amp=0.004, tint=(0.95, 0.92, 0.9), seed=4)
add('Head', 'mouth', ellipsoid((0, 1.915, 0.83), (0.045, 0.018, 0.1)))
add('Jaw', 'skin', tube([(0, 1.93, 0.68), (0, 1.88, 0.80), (0, 1.88, 0.93)], [(0.055, 0.04), (0.045, 0.03), (0.03, 0.025)], sides=10, sub=4, ext=0.015), amp=0.003, tint=(0.95, 0.92, 0.9))
add('Jaw', 'mouth', ellipsoid((0, 1.9, 0.82), (0.035, 0.012, 0.1)))
for s, n in SIDES:
    # eyes
    add('Head', 'socket', ellipsoid((s * 0.075, 2.06, 0.755), (0.05, 0.042, 0.036)))
    add('Head', 'eye', ellipsoid((s * 0.078, 2.06, 0.792), (0.036, 0.016, 0.016), R=Rz(s * 0.45), seg=10, rings=6))
    # brow
    add('Head', 'skin', ellipsoid((s * 0.07, 2.1, 0.775), (0.065, 0.016, 0.04), R=Rz(-s * 0.4)), amp=0.003, tint=(0.8, 0.78, 0.78))
    # ears
    add('Head', 'skin', tube([(s * 0.1, 2.06, 0.6), (s * 0.19, 2.12, 0.55), (s * 0.28, 2.24, 0.5)], [0.035, 0.028, 0.002], sides=8, sub=3), amp=0.002)
    # horns
    add('Head', 'bone', tube([(s * 0.06, 2.14, 0.64), (s * 0.1, 2.27, 0.58), (s * 0.08, 2.4, 0.46)], [0.026, 0.018, 0.002], sides=8, sub=4), amp=0.002, freq=25, seed=6)
    # nostril
    add('Head', 'socket', ellipsoid((s * 0.022, 1.99, 0.95), (0.009, 0.006, 0.012), seg=8, rings=5))
# teeth
for i in range(9):
    z = 0.745 + 0.025 * i
    for sx in (-1, 1):
        x = sx * (0.05 - 0.012 * (i / 8))
        big = i in (2,)
        Lh = 0.1 if big else 0.028 + 0.01 * ((i * 7) % 3)
        add('Head', 'teeth', tube([(x, 1.915, z), (x, 1.915 - Lh * 0.5, z + 0.004), (x, 1.915 - Lh, z + 0.012)], [0.009 if big else 0.006, 0.006 if big else 0.004, 0.0008], sides=5, sub=2))
        Lh = 0.085 if i == 3 else 0.026 + 0.012 * ((i * 5) % 3)
        x2 = sx * (0.036 - 0.006 * (i / 8))
        add('Jaw', 'teeth', tube([(x2, 1.896, z + 0.01), (x2, 1.896 + Lh * 0.5, z + 0.004), (x2, 1.896 + Lh, z - 0.004)], [0.007 if i == 3 else 0.005, 0.004, 0.0008], sides=5, sub=2))
# hair
for i in range(18):
    x0 = -0.1 + 0.2 * i / 17
    zs = 0.5 + 0.07 * rng.random()
    thick = (i % 3 == 0)
    pts = []
    for t in (0, 0.25, 0.5, 0.75, 1.0):
        pts.append((x0 * (1 + 0.7 * t) + 0.045 * sin(t * 6 + i * 1.7), 2.13 - 0.85 * t - 0.03 * rng.random(), zs - 0.95 * t))
    r0 = 0.02 if thick else 0.01
    add('Hair', 'hair', tube(pts, [r0, r0 * 0.8, r0 * 0.6, r0 * 0.4, 0.002], sides=5, sub=3))

# ---------------------------------------------------------------- tongue
for i in range(6):
    p0, p1 = TONGUE[i], TONGUE[i + 1]
    w0, w1 = 0.034 - 0.003 * i, 0.034 - 0.003 * (i + 1)
    add('Tongue%d' % i, 'tongue', tube([p0, p1], [(w0, w0 * 0.4), (w1, w1 * 0.4)], sides=8, sub=3, ext=0.012), amp=0.002, freq=25)
tip = np.array(TONGUE[6])
for sx in (-1, 1):
    add('Tongue5', 'tongue', tube([tip, tip + (sx * 0.015, -0.05, 0.01), tip + (sx * 0.035, -0.1, 0.015)], [(0.017, 0.007), (0.012, 0.005), (0.002, 0.002)], sides=6, sub=3))

# ---------------------------------------------------------------- arms / hands
for s, n in SIDES:
    sh, el, wr = J['Shoulder' + n], J['Elbow' + n], J['Wrist' + n]
    add('Shoulder' + n, 'skin', tube([sh, el], [0.055, 0.042], sides=10, sub=3, ext=0.03), amp=0.004, tint=skin_t, seed=7)
    add('Elbow' + n, 'skin', tube([el, wr], [0.042, 0.026], sides=10, sub=3, ext=0.03), amp=0.004, tint=skin_t, seed=8)
    add('Elbow' + n, 'bone', tube([el + (s * 0.02, 0, -0.03), el + (s * 0.07, 0.04, -0.1), el + (s * 0.11, 0.1, -0.17)], [0.022, 0.014, 0.002], sides=6, sub=3))
    wx = s * 0.55
    add('Wrist' + n, 'skin', ellipsoid((wx, 0.56, 0.55), (0.04, 0.055, 0.026)), tint=skin_t)
    for k, dx in enumerate((-0.03, -0.01, 0.01, 0.03)):
        x = wx + s * dx; L = (0.24, 0.3, 0.29, 0.22)[k]
        pts = [(x, 0.52, 0.55), (x, 0.52 - 0.5 * L, 0.575 + 0.01 * k), (x, 0.52 - 0.95 * L, 0.64 + 0.02 * k)]
        add('Wrist' + n, 'skin', tube(pts, [0.012, 0.0095, 0.0075], sides=6, sub=3), tint=skin_t)
        claw('Wrist' + n, pts[-1], (0, -0.45, 0.9), 0.1 + 0.03 * (k in (1, 2)), 0.0075, curl=0.4)
    tp = [(wx - s * 0.035, 0.58, 0.57), (wx - s * 0.07, 0.5, 0.625), (wx - s * 0.075, 0.43, 0.69)]
    add('Wrist' + n, 'skin', tube(tp, [0.012, 0.01, 0.008], sides=6, sub=3), tint=skin_t)
    claw('Wrist' + n, tp[-1], (0, -0.4, 0.9), 0.08, 0.007)

# ---------------------------------------------------------------- legs / feet
for s, n in SIDES:
    hp, kn, an = J['Thigh' + n], J['Knee' + n], J['Ankle' + n]
    add('Thigh' + n, 'skin', tube([hp, kn], [0.09, 0.055], sides=10, sub=3, ext=0.03), amp=0.005, tint=skin_t, seed=9)
    add('Knee' + n, 'skin', tube([kn, an], [0.05, 0.028], sides=10, sub=3, ext=0.03), amp=0.004, tint=skin_t, seed=10)
    add('Knee' + n, 'bone', ellipsoid(kn + (0, 0.0, 0.045), (0.035, 0.04, 0.035)))
    add('Ankle' + n, 'skin', ellipsoid(an + (0, -0.01, 0.0), (0.04, 0.045, 0.05)), tint=skin_t)
    ball = np.array([s * 0.2, 0.05, 0.18])
    add('Ankle' + n, 'skin', tube([an, an * 0.5 + ball * 0.5 + (0, 0.02, 0), ball], [0.03, 0.025, 0.028], sides=8, sub=3), tint=skin_t)
    add('Ankle' + n, 'bone', tube([an + (0, 0.0, -0.03), an + (0, -0.06, -0.1), an + (0, -0.15, -0.14)], [0.018, 0.012, 0.002], sides=6, sub=3))
    for k, dx in enumerate((-0.05, 0.0, 0.05)):
        x = s * 0.2 + dx
        pts = [ball + (dx, 0.0, 0.0), (x, 0.035, 0.27 + 0.03 * (k == 1)), (x, 0.02, 0.36 + 0.04 * (k == 1))]
        add('Ankle' + n, 'skin', tube(pts, [0.018, 0.014, 0.011], sides=6, sub=3), tint=skin_t)
        claw('Ankle' + n, pts[-1], (0, -0.2, 1), 0.085, 0.01, curl=0.8)

# ---------------------------------------------------------------- tail
tp = [J['Tail0'], J['Tail1'], J['Tail2'], J['Tail3'], np.array([0, 0.3, -2.05])]
rad = [0.075, 0.055, 0.04, 0.026, 0.004]
for i in range(4):
    add('Tail%d' % i, 'skin', tube([tp[i], tp[i + 1]], [rad[i], rad[i + 1]], sides=8, sub=4, ext=0.03), amp=0.004, tint=skin_t, seed=11 + i)
    for k in range(3):
        t = (k + 0.5) / 3
        p = tp[i] * (1 - t) + tp[i + 1] * t
        r = rad[i] * (1 - t) + rad[i + 1] * t
        add('Tail%d' % i, 'bone', tube([p + (0, r * 0.8, 0), p + (0, r + 0.03, -0.03), p + (0, r + 0.075 * (1 - 0.15 * i), -0.07)], [0.014, 0.009, 0.001], sides=5, sub=2))

# ---------------------------------------------------------------- wings (bat-like)
def wing(s, n):
    B0 = np.array([s * 0.15, 1.7, -0.02]); B1 = np.array([s * 0.14, 1.15, -0.1])
    E = np.array([s * 0.95, 2.25, -0.45])
    f = [np.array([s * 2.35, 2.6, -1.0]), np.array([s * 2.55, 1.75, -1.25]),
         np.array([s * 2.05, 0.95, -1.05]), np.array([s * 1.3, 0.6, -0.65])]
    J_ = 'Wing' + n
    add(J_, 'skin', tube([B0, B0 * 0.4 + E * 0.6 + (0, 0.15, -0.1), E], [0.035, 0.028, 0.022], sides=8, sub=4, ext=0.02), amp=0.004, tint=skin_t)
    add(J_, 'bone', tube([E + (0, 0, 0.0), E + (s * 0.08, 0.13, 0.12), E + (s * 0.1, 0.22, 0.2)], [0.02, 0.012, 0.002], sides=6, sub=3))
    C = (E + f[2] + B1) / 3
    for i, fp in enumerate(f):
        mid = (E + fp) / 2 + (0, 0.07 * (1 if i < 2 else -1), -0.06)
        add(J_, 'skin', tube([E, mid, fp], [0.02, 0.012, 0.003], sides=6, sub=5), tint=skin_t)
    outline = [B0, E, f[0]]
    for i in range(3):
        m = (f[i] + f[i + 1]) / 2
        outline.append(m + (C - m) * 0.3)
        outline.append(f[i + 1])
    outline.append(B1)
    outline = np.array(outline)
    # triangulated fan with radial/edge subdivision for sag and wrinkles
    rings, per = 6, 5
    P = [C]; idx = {}
    for k in range(1, rings + 1):
        for e in range(len(outline)):
            p, q = outline[e], outline[(e + 1) % len(outline)]
            for m in range(per):
                pt = p + (q - p) * (m / per)
                idx[(k, e, m)] = len(P)
                P.append(C + (pt - C) * (k / rings))
    F = []
    for e in range(len(outline)):
        for m in range(per):
            nm = (e, m + 1) if m + 1 < per else ((e + 1) % len(outline), 0)
            F.append((0, idx[(1, e, m)], idx[(1, nm[0], nm[1])]))
            for k in range(1, rings):
                a, b = idx[(k, e, m)], idx[(k, nm[0], nm[1])]
                c, d = idx[(k + 1, e, m)], idx[(k + 1, nm[0], nm[1])]
                F += [(a, c, b), (b, c, d)]
    P = np.array(P)
    P[:, 2] += 0.045 * np.sin(P[:, 0] * 7 + P[:, 1] * 4) * np.linalg.norm(P - C, axis=1) * 0.6
    add(J_, 'membrane', (P, np.array(F, np.uint32)), tint=(1, 1, 1), freq=3, shade=0.7)

for s, n in SIDES:
    wing(s, n)

# ---------------------------------------------------------------- assemble glTF
names = ['Root'] + list(J.keys())
children = {nm: [] for nm in names}
for k, p in PARENT.items():
    children[p].append(k)

class GLB:
    def __init__(self):
        self.bin = bytearray(); self.views = []; self.accs = []
    def view(self, data, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        v = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(data)}
        if target: v["target"] = target
        self.bin += data; self.views.append(v); return len(self.views) - 1
    def acc(self, arr, typ, ctype, target=None, mm=False):
        arr = np.ascontiguousarray(arr)
        a = {"bufferView": self.view(arr.tobytes(), target), "componentType": ctype, "count": len(arr), "type": typ}
        if mm:
            flat = arr.reshape(len(arr), -1)
            a["min"] = flat.min(0).astype(float).tolist(); a["max"] = flat.max(0).astype(float).tolist()
        self.accs.append(a); return len(self.accs) - 1

g = GLB()
materials = []
for nm in MAT_ORDER:
    m = MATS[nm]
    mat = {"name": nm, "pbrMetallicRoughness": {"baseColorFactor": list(m['c']) + [1.0], "metallicFactor": m['m'], "roughnessFactor": m['r']}}
    if m.get('ds'): mat["doubleSided"] = True
    if 'e' in m:
        mat["emissiveFactor"] = list(m['e'])
        mat["extensions"] = {"KHR_materials_emissive_strength": {"emissiveStrength": m['es']}}
    materials.append(mat)

meshes = []; mesh_of = {}
tris = 0
for jn in names:
    prims = []
    for mi, mn in enumerate(MAT_ORDER):
        d = PARTS.get((jn, mn))
        if not d: continue
        P = np.vstack(d['P']) - (J[jn] if jn in J else 0)
        F = np.vstack(d['F']); C = np.vstack(d['C'])
        N = vnormals(P, F)
        tris += len(F)
        prims.append({"attributes": {
            "POSITION": g.acc(P.astype(np.float32), "VEC3", 5126, 34962, True),
            "NORMAL": g.acc(N.astype(np.float32), "VEC3", 5126, 34962),
            "COLOR_0": g.acc(C.astype(np.float32), "VEC3", 5126, 34962)},
            "indices": g.acc(F.reshape(-1).astype(np.uint32), "SCALAR", 5125, 34963), "material": mi, "mode": 4})
    if prims:
        meshes.append({"name": jn + "_mesh", "primitives": prims}); mesh_of[jn] = len(meshes) - 1

nodes = []; nid = {nm: i for i, nm in enumerate(names)}
for nm in names:
    nd = {"name": nm}
    if nm in J:
        nd["translation"] = (J[nm] - (J[PARENT[nm]] if PARENT[nm] in J else 0)).astype(float).tolist()
    if children[nm]: nd["children"] = [nid[c] for c in children[nm]]
    if nm in mesh_of: nd["mesh"] = mesh_of[nm]
    nodes.append(nd)

# ---------------------------------------------------------------- animations
def qmul(a, b):
    x1, y1, z1, w1 = a; x2, y2, z2, w2 = b
    return (w1*x2 + x1*w2 + y1*z2 - z1*y2, w1*y2 - x1*z2 + y1*w2 + z1*x2,
            w1*z2 + x1*y2 - y1*x2 + z1*w2, w1*w2 - x1*x2 - y1*y2 - z1*z2)

def eq(ex, ey, ez):
    ex, ey, ez = [math.radians(v) / 2 for v in (ex, ey, ez)]
    return qmul((0, 0, sin(ez), cos(ez)), qmul((0, sin(ey), 0, cos(ey)), (sin(ex), 0, 0, cos(ex))))

def pos(w, ph=0.0): return sin(w + ph)

def idle(w):
    P = {'Hips': (0, 0, 1.5 * sin(w)), 'Spine': (2.5 * sin(2*w), 3 * sin(w), 0),
         'Chest': (3 * sin(2*w - .6), 0, 1.5 * sin(w + 1)),
         'Neck': (-3 + 4 * sin(2*w - 1.2), 10 * sin(w) + 4 * sin(3*w), 3 * sin(w + 2)),
         'Head': (3 * sin(3*w), 6 * sin(w + 1), 4 * sin(2*w + .7) + 2 * sin(5*w)),
         'Jaw': (8 + 6 * sin(3*w) + 3 * sin(7*w), 0, 0), 'Hair': (4 * sin(2*w - 1), 0, 5 * sin(w)),
         'Gut': (6 * sin(2*w - .5), 0, 4 * sin(w))}
    for i in range(6): P['Tongue%d' % i] = (7 * sin(2*w - .8*i), 0, 8 * sin(w - .7*i + 1))
    for i in range(4): P['Tail%d' % i] = (4 * sin(2*w - .5*i), 12 * sin(w - .6*i), 0)
    for s, n in SIDES:
        ph = 0.7 if s == 1 else 2.2
        P['Shoulder' + n] = (4 * sin(2*w + ph), 0, s * (-3 + 2 * sin(w + ph)))
        P['Elbow' + n] = (-8 + 5 * sin(2*w + ph + 1), 0, 0)
        P['Wrist' + n] = (10 * sin(3*w + ph), 0, 4 * sin(2*w))
        P['Wing' + n] = (0, s * 4 * sin(w + ph), s * 10 * sin(2*w + ph))
        P['Thigh' + n] = (1.5 * sin(w + ph), 0, 0); P['Knee' + n] = (1.0 * sin(w + ph), 0, 0); P['Ankle' + n] = (0, 0, 0)
    return P, (0, 1.0 + 0.015 * sin(2*w), 0)

def walk(w):
    P = {'Hips': (0, 6 * sin(w), 3 * sin(w)), 'Spine': (6, -8 * sin(w), 0), 'Chest': (3 * cos(2*w), -6 * sin(w), 0),
         'Neck': (-6, 8 * sin(w), 0), 'Head': (2 * sin(2*w), 6 * sin(w), 3 * sin(w)),
         'Jaw': (14 + 6 * sin(2*w), 0, 0), 'Hair': (10 * sin(2*w - 1), 0, 8 * sin(w)), 'Gut': (10 * sin(2*w - .5), 0, 6 * sin(w))}
    for i in range(6): P['Tongue%d' % i] = (12 * sin(2*w - .7*i), 0, 6 * sin(w - .7*i))
    for i in range(4): P['Tail%d' % i] = (3 * sin(2*w - .5*i), 18 * sin(w - .7*i), 0)
    for s, n in SIDES:
        ph = 0.0 if s == 1 else pi
        a = sin(w + ph); sw = max(0.0, a) ** 1.5
        P['Thigh' + n] = (-30 * a, 0, 0); P['Knee' + n] = (8 + 35 * sw, 0, 0)
        P['Ankle' + n] = (15 * a - 0.5 * (8 + 35 * sw), 0, 0)
        P['Shoulder' + n] = (25 * a, 0, s * -4); P['Elbow' + n] = (-15 - 10 * a, 0, 0)
        P['Wrist' + n] = (8 * sin(2*w), 0, 0)
        P['Wing' + n] = (0, s * 6 * sin(w), s * 20 * sin(2*w + ph))
    return P, (0, 0.97 + 0.03 * cos(2*w), 0)

def roar(w):
    r = (1 - cos(w)) / 2; sh = r ** 2
    P = {'Hips': (0, 0, 0), 'Spine': (-6 * r, 0, 0), 'Chest': (-12 * r, 0, 0), 'Neck': (-12 * r, 0, 0),
         'Head': (-25 * r + 3 * sin(8*w) * r, 0, 0), 'Jaw': (55 * r + 6 * sin(9*w) * r, 0, 0),
         'Hair': (-12 * r + 6 * sin(3*w), 0, 8 * sin(2*w) * r), 'Gut': (8 * sin(2*w) * r, 0, 5 * sin(3*w) * r)}
    for i in range(6): P['Tongue%d' % i] = (-30 * r / (1 + i * .3) + 15 * r * sin(3*w - .8*i), 0, 10 * r * sin(2*w - .6*i))
    for i in range(4): P['Tail%d' % i] = (-15 * r / (1 + i), 15 * sin(2*w - .7*i) * r, 0)
    for s, n in SIDES:
        P['Shoulder' + n] = (-60 * r, 0, s * 35 * r); P['Elbow' + n] = (-50 * r, 0, 0)
        P['Wrist' + n] = (-20 * r + 15 * sin(6*w) * r, 0, 0)
        P['Wing' + n] = (0, s * -15 * r, s * (25 * r + 20 * r * sin(4*w)))
        P['Thigh' + n] = (-20 * r, 0, 0); P['Knee' + n] = (35 * r, 0, 0); P['Ankle' + n] = (-15 * r, 0, 0)
    return P, (0, 1.0 - 0.08 * r, 0)

animations = []
def make_anim(name, fn, T, fps):
    N = max(8, int(round(T * fps)))
    times = np.linspace(0, T, N + 1).astype(np.float32)
    rot = {}; tr = []
    for i in range(N + 1):
        w = 2 * pi * (i % N) / N
        P, hp = fn(w)
        for jn, e in P.items(): rot.setdefault(jn, []).append(eq(*e))
        tr.append(hp)
    tin = g.acc(times, "SCALAR", 5126, None, True)
    samplers, channels = [], []
    for jn, qs in rot.items():
        out = g.acc(np.array(qs, np.float32), "VEC4", 5126)
        samplers.append({"input": tin, "output": out, "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": nid[jn], "path": "rotation"}})
    out = g.acc(np.array(tr, np.float32), "VEC3", 5126)
    samplers.append({"input": tin, "output": out, "interpolation": "LINEAR"})
    channels.append({"sampler": len(samplers) - 1, "target": {"node": nid['Hips'], "path": "translation"}})
    animations.append({"name": name, "samplers": samplers, "channels": channels})

make_anim('Idle', idle, 4.0, 20)
make_anim('Walk', walk, 1.2, 30)
make_anim('Roar', roar, 2.5, 30)

gltf = {
    "asset": {"version": "2.0", "generator": "procedural-aswang"},
    "extensionsUsed": ["KHR_materials_emissive_strength"],
    "scene": 0,
    "scenes": [{"name": "Aswang", "nodes": [nid['Root']], "extras": {"animations": ["Idle", "Walk", "Roar"], "heightMeters": 2.4}}],
    "nodes": nodes, "meshes": meshes, "materials": materials, "accessors": g.accs, "bufferViews": g.views,
    "animations": animations, "buffers": [{"byteLength": len(g.bin)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * (-len(js) % 4)
bn = bytes(g.bin) + b'\0' * (-len(g.bin) % 4)
out = sys.argv[1] if len(sys.argv) > 1 else 'aswang.glb'
with open(out, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bn)))
    f.write(struct.pack('<I4s', len(js), b'JSON') + js)
    f.write(struct.pack('<I4s', len(bn), b'BIN\0') + bn)
print('wrote', out, 'triangles', tris, 'bytes', 12 + 16 + len(js) + len(bn))

# ---------------------------------------------------------------- preview (software raster)
if '--preview' in sys.argv:
    from PIL import Image, ImageDraw
    tri_list = []
    for (jn, mn), d in PARTS.items():
        P = np.vstack(d['P']); F = np.vstack(d['F']); C = np.vstack(d['C'])
        N = vnormals(P, F); m = MATS[mn]
        base = np.array(m['c']) if mn != 'eye' else np.array(m['e'])
        col = (C * base) if mn != 'eye' else np.tile(base, (len(P), 1))
        tri_list.append((P, F, N, col, mn == 'eye', m.get('ds', False)))
    W, H = 520, 760
    img = Image.new('RGB', (W * 3, H), (14, 12, 16))
    for vi, ang in enumerate((0, 55, 90)):
        a = math.radians(ang)
        Ry = np.array([[cos(a), 0, sin(a)], [0, 1, 0], [-sin(a), 0, cos(a)]])
        im = Image.new('RGB', (W, H), (14, 12, 16)); dr = ImageDraw.Draw(im)
        items = []
        for P, F, N, col, em, ds in tri_list:
            Q = (P - (0, 1.2, 0)) @ Ry.T; Nn = N @ Ry.T
            fc = Q[F].mean(1); fn = np.cross(Q[F[:, 1]] - Q[F[:, 0]], Q[F[:, 2]] - Q[F[:, 0]])
            vis = (fn[:, 2] > 0) | ds
            L = norm(np.array([0.4, 0.7, 0.8]))
            for t in np.where(vis)[0]:
                f = F[t]
                sh = 1.0 if em else 0.25 + 0.9 * max(0.0, abs(float(Nn[f].mean(0) @ L)) if ds else float(Nn[f].mean(0) @ L))
                c = np.clip(col[f].mean(0) * sh * 2.1 * 255, 0, 255)
                items.append((fc[t, 2], [(W / 2 + Q[k, 0] * 215 * 1.0, H * 0.58 - Q[k, 1] * 215) for k in f], tuple(int(x) for x in c)))
        items.sort(key=lambda x: x[0])
        for _, poly, c in items: dr.polygon(poly, fill=c)
        img.paste(im, (vi * W, 0))
    img.save('/home/claude/preview.png'); print('preview saved')
