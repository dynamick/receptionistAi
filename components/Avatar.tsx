
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

// Extend JSX namespace for R3F
declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

interface AvatarProps {
  modelUrl: string;
  isSpeaking: boolean;
  audioAmplitude: number;
}

export const Avatar: React.FC<AvatarProps> = ({ modelUrl, isSpeaking, audioAmplitude }) => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(modelUrl);
  const { actions } = useAnimations(animations, group);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  // Riferimenti ai componenti del corpo per animazione procedurale
  const bones = useMemo(() => {
    const b: { head?: THREE.Bone; neck?: THREE.Bone; spine?: THREE.Bone } = {};
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const name = child.name.toLowerCase();
        if (name.includes('head')) b.head = child as THREE.Bone;
        if (name.includes('neck')) b.neck = child as THREE.Bone;
        if (name.includes('spine')) b.spine = child as THREE.Bone;
      }
    });
    return b;
  }, [scene]);

  // Gestione Animazioni Base (Clips)
  useEffect(() => {
    if (!actions) return;
    const idleName = Object.keys(actions).find(n => n.toLowerCase().includes('idle')) || Object.keys(actions)[0];
    const talkName = Object.keys(actions).find(n => n.toLowerCase().includes('talk')) || idleName;
    const nextAction = isSpeaking ? talkName : idleName;

    if (nextAction !== currentAction) {
      const prev = currentAction ? actions[currentAction] : null;
      const next = actions[nextAction];
      if (next) {
        if (prev) prev.fadeOut(0.5);
        next.reset().fadeIn(0.5).play();
        setCurrentAction(nextAction);
      }
    }
  }, [isSpeaking, actions, currentAction]);

  useFrame((state) => {
    if (!scene) return;
    const t = state.clock.getElapsedTime();
    
    // 1. LIP SYNC & FACIAL EXPRESSIONS
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          // Lip Sync naturale: 
          const mouthOpenIdx = mesh.morphTargetDictionary['mouthOpen'] ?? mesh.morphTargetDictionary['jawOpen'];
          if (mouthOpenIdx !== undefined) {
            const rawTarget = isSpeaking ? audioAmplitude * 0.7 : 0;
            const clampedTarget = Math.min(rawTarget, 0.5); 
            
            mesh.morphTargetInfluences[mouthOpenIdx] = THREE.MathUtils.lerp(
              mesh.morphTargetInfluences[mouthOpenIdx], 
              clampedTarget, 
              0.25
            );
          }

          const mouthSmileIdx = mesh.morphTargetDictionary['mouthSmile'];
          if (mouthSmileIdx !== undefined && isSpeaking) {
             mesh.morphTargetInfluences[mouthSmileIdx] = THREE.MathUtils.lerp(
              mesh.morphTargetInfluences[mouthSmileIdx],
              audioAmplitude * 0.2,
              0.1
            );
          }

          // Sbattere le palpebre automatico
          const blinkNames = ['eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'];
          const isBlinkTime = Math.sin(t * 3.5) > 0.96; 
          const blinkValue = isBlinkTime ? 1 : 0;
          
          blinkNames.forEach(name => {
            const idx = mesh.morphTargetDictionary![name];
            if (idx !== undefined) {
              mesh.morphTargetInfluences![idx] = THREE.MathUtils.lerp(
                mesh.morphTargetInfluences![idx], 
                blinkValue, 
                0.6
              );
            }
          });
        }
      }
    });

    // 2. GESTI IDLE PROCEDURALI (Head & Body Movements)
    if (!isSpeaking) {
      // Rotazione testa sottile (Nodding/Tilting)
      if (bones.head) {
        bones.head.rotation.x += Math.sin(t * 0.5) * 0.0005; // Lieve cenno su/giù
        bones.head.rotation.y += Math.cos(t * 0.3) * 0.0005; // Lieve rotazione destra/sinistra
        bones.head.rotation.z += Math.sin(t * 0.2) * 0.0005; // Lieve inclinazione
      }
      
      // Spostamento peso (Body sway)
      if (group.current) {
        group.current.rotation.z = THREE.MathUtils.lerp(
          group.current.rotation.z,
          Math.sin(t * 0.4) * 0.015,
          0.05
        );
        group.current.rotation.y = THREE.MathUtils.lerp(
          group.current.rotation.y,
          Math.cos(t * 0.2) * 0.01,
          0.05
        );
      }
    } else {
      // Quando parla, riduciamo i movimenti idle per non andare in conflitto con l'animazione Talk
      if (group.current) {
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      }
    }

    // 3. MOVIMENTO GLOBALE (Floating)
    if (group.current) {
        group.current.position.y = Math.sin(t * 1.5) * 0.01 - 1.6;
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

useGLTF.preload('avatar.glb');
