
import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as THREE from 'three';

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

  // Gestione delle transizioni tra animazioni (Idle vs Talking)
  useEffect(() => {
    if (!actions) return;

    // Ready Player Me spesso include diverse animazioni o possiamo caricarle esternamente.
    // Cerchiamo i nomi standard di Mixamo/RPM
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
    
    // 1. ANIMAZIONE FACCIALE (Lip Sync, Blinking, Smile)
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          // --- Lip Sync (Bocca) ---
          const mouthOpenIdx = mesh.morphTargetDictionary['mouthOpen'];
          const jawOpenIdx = mesh.morphTargetDictionary['jawOpen'];
          const visemeAAIdx = mesh.morphTargetDictionary['viseme_aa'];
          
          if (isSpeaking) {
            const targetInfluence = THREE.MathUtils.lerp(
              mesh.morphTargetInfluences[mouthOpenIdx || 0] || 0,
              audioAmplitude * 1.5 + Math.random() * 0.1,
              0.4
            );
            if (mouthOpenIdx !== undefined) mesh.morphTargetInfluences[mouthOpenIdx] = targetInfluence;
            if (jawOpenIdx !== undefined) mesh.morphTargetInfluences[jawOpenIdx] = targetInfluence * 0.5;
            if (visemeAAIdx !== undefined) mesh.morphTargetInfluences[visemeAAIdx] = targetInfluence * 0.3;
          } else {
            if (mouthOpenIdx !== undefined) {
              mesh.morphTargetInfluences[mouthOpenIdx] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[mouthOpenIdx], 0, 0.1);
            }
          }

          // --- Blinking (Entrambi gli occhi) ---
          const eyeBlinkL = mesh.morphTargetDictionary['eyeBlinkLeft'];
          const eyeBlinkR = mesh.morphTargetDictionary['eyeBlinkRight'];
          const eyesClosed = mesh.morphTargetDictionary['eyesClosed'];
          const blinkValue = Math.sin(t * 0.5) > 0.98 ? 1 : 0;
          const currentBlink = THREE.MathUtils.lerp(mesh.morphTargetInfluences[eyeBlinkL ?? eyesClosed ?? 0] || 0, blinkValue, 0.5);
          if (eyeBlinkL !== undefined) mesh.morphTargetInfluences[eyeBlinkL] = currentBlink;
          if (eyeBlinkR !== undefined) mesh.morphTargetInfluences[eyeBlinkR] = currentBlink;

          // --- Smile (Sorriso costante e piacevole) ---
          const smileIdx = mesh.morphTargetDictionary['mouthSmile'];
          const targetSmile = isSpeaking ? 0.4 : 0.25;
          if (smileIdx !== undefined) {
            mesh.morphTargetInfluences[smileIdx] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[smileIdx], targetSmile, 0.1);
          }
        }
      }
    });

    // 2. MOVIMENTI NATURALI DEL CORPO (Micro-movimenti)
    // Questi movimenti si sommano alle animazioni caricate (Mixamo/RPM)
    scene.traverse((object) => {
      if (object instanceof THREE.Bone) {
        // Movimento della testa (Neck) - guarda leggermente verso "l'utente" o ondeggia
        if (object.name.includes('Neck')) {
          const intensity = isSpeaking ? 0.08 : 0.04;
          object.rotation.y = Math.sin(t * 0.5) * intensity;
          object.rotation.x = Math.cos(t * 0.3) * 0.02;
        }
        // Movimento del busto (Spine) - simulazione respiro
        if (object.name.includes('Spine')) {
          object.rotation.x = (Math.sin(t * 1.2) * 0.015) + 0.05; // 0.05 è un offset naturale
        }
      }
    });

    // 3. POSIZIONAMENTO E FLOATING
    if (group.current) {
        // Floating leggero per non sembrare una statua
        group.current.position.y = Math.sin(t * 1.5) * 0.015 - 1.6;
        // Rotazione impercettibile per dare profondità
        group.current.rotation.y = Math.sin(t * 0.2) * 0.02;
    }
  });

  return (
    <group ref={group} dispose={null} scale={[1, 1, 1]}>
      <primitive object={scene} />
    </group>
  );
};

useGLTF.preload('avatar.glb');
