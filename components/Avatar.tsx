
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import { useGLTF, useAnimations, useFBX } from '@react-three/drei';
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

// URLs delle animazioni su GitHub (formato RAW per il caricamento)
const ANIMATION_URLS = {
  talking: 'https://cdn.statically.io/gh/dynamick/cdn@main/receptionistAI/Talking.fbx',
  rumba: 'https://cdn.statically.io/gh/dynamick/cdn@main/receptionistAI/rumba-dancing.fbx',
  idle: 'https://cdn.statically.io/gh/dynamick/cdn@main/receptionistAI/standing-idle.fbx'
};

export const Avatar: React.FC<AvatarProps> = ({ modelUrl, isSpeaking, audioAmplitude }) => {
  const group = useRef<THREE.Group>(null);
  const [isRandomDancing, setIsRandomDancing] = useState(false);
  
  // 1. Modello base GLTF (Ready Player Me)
  const { scene, animations: gltfAnimations } = useGLTF(modelUrl);
  
  // 2. Caricamento file FBX da URL remote
  const talkFbx = useFBX(ANIMATION_URLS.talking);
  const idleRumbaFbx = useFBX(ANIMATION_URLS.rumba);
  const idleStandingFbx = useFBX(ANIMATION_URLS.idle);

  // 3. Elaborazione e Retargeting
  const allAnimations = useMemo(() => {
    const clips: THREE.AnimationClip[] = [...gltfAnimations];
    
    const processFbx = (fbx: THREE.Group, prefix: string) => {
      if (!fbx) return;
      fbx.animations.forEach((clip, index) => {
        const newClip = clip.clone();
        newClip.name = `${prefix}_${index}`;
        
        // Retargeting: Rimuoviamo il prefisso 'mixamorig' per allinearlo allo scheletro Ready Player Me
        newClip.tracks.forEach((track) => {
          track.name = track.name.replace(/mixamorig|MixamoRig/g, '');
        });
        clips.push(newClip);
      });
    };

    processFbx(idleRumbaFbx, 'fbx_idle_rumba');
    processFbx(idleStandingFbx, 'fbx_idle_standing');
    processFbx(talkFbx, 'fbx_talk');
    
    return clips;
  }, [gltfAnimations, idleRumbaFbx, idleStandingFbx, talkFbx]);

  const { actions } = useAnimations(allAnimations, group);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  // Riferimenti ossa per micro-movimenti e modifiche fisiche
  const bones = useMemo(() => {
    const b: { 
      head?: THREE.Bone; 
      neck?: THREE.Bone; 
      leftBreast?: THREE.Bone; 
      rightBreast?: THREE.Bone 
    } = {};
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        const name = child.name;
        const lowerName = name.toLowerCase();
        if (lowerName.includes('head')) b.head = child as THREE.Bone;
        if (lowerName.includes('neck')) b.neck = child as THREE.Bone;
        if (lowerName.includes('leftbreast')) b.leftBreast = child as THREE.Bone;
        if (lowerName.includes('rightbreast')) b.rightBreast = child as THREE.Bone;
      }
    });
    return b;
  }, [scene]);

  // Gestione del ballo casuale durante l'idle
  useEffect(() => {
    if (isSpeaking) {
      setIsRandomDancing(false);
      return;
    }

    const triggerChance = () => {
      if (!isSpeaking && Math.random() < 0.15) {
        setIsRandomDancing(true);
        setTimeout(() => setIsRandomDancing(false), 7000);
      }
    };

    const interval = setInterval(triggerChance, 12000);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  // 4. Gestione Transizioni Animazioni
  useEffect(() => {
    if (!actions) return;
    
    const names = Object.keys(actions);
    const talkName = names.find(n => n.includes('fbx_talk')) || names.find(n => n.toLowerCase().includes('talk'));
    const idleStandingName = names.find(n => n.includes('fbx_idle_standing'));
    const idleRumbaName = names.find(n => n.includes('fbx_idle_rumba'));
    
    let nextAction = names[0];
    if (isSpeaking) {
      nextAction = talkName || names[0];
    } else if (isRandomDancing) {
      nextAction = idleRumbaName || idleStandingName || names[0];
    } else {
      nextAction = idleStandingName || names[0];
    }

    if (nextAction && nextAction !== currentAction) {
      const prev = currentAction ? actions[currentAction] : null;
      const next = actions[nextAction];
      
      if (next) {
        if (prev) prev.fadeOut(0.5);
        next.reset().fadeIn(0.5).play();
        setCurrentAction(nextAction);
      }
    }
  }, [isSpeaking, isRandomDancing, actions, currentAction, allAnimations]);

  useFrame((state) => {
    if (!scene) return;
    const t = state.clock.getElapsedTime();
    
    // 5. Lip Sync, Facial Expressions & Body Shape
    scene.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = child as THREE.SkinnedMesh;
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          // Apertura bocca (Jaw) basata sull'ampiezza audio
          const mouthOpenIdx = mesh.morphTargetDictionary['mouthOpen'] ?? mesh.morphTargetDictionary['jawOpen'];
          if (mouthOpenIdx !== undefined) {
            const target = isSpeaking ? audioAmplitude * 0.8 : 0;
            const current = mesh.morphTargetInfluences[mouthOpenIdx];
            const desired = Math.min(target, 0.45);
            mesh.morphTargetInfluences[mouthOpenIdx] = current + (desired - current) * 0.2;
          }

          // Sorriso (Smile)
          const smileTargets = ['mouthSmile', 'mouthSmileLeft', 'mouthSmileRight'];
          smileTargets.forEach(name => {
            const idx = mesh.morphTargetDictionary![name];
            if (idx !== undefined) {
              const baseSmile = 0.2;
              const activeSmile = isSpeaking ? 0.3 : 0;
              const desiredSmile = baseSmile + activeSmile;
              const currentSmile = mesh.morphTargetInfluences![idx];
              mesh.morphTargetInfluences![idx] = currentSmile + (desiredSmile - currentSmile) * 0.1;
            }
          });

          // Dimensione Corpo/Seno (Morph Target se presente)
          const breastMorphIdx = mesh.morphTargetDictionary['breastSize'] ?? mesh.morphTargetDictionary['chestSize'];
          if (breastMorphIdx !== undefined) {
            mesh.morphTargetInfluences[breastMorphIdx] = 0.8;
          }

          // Blinking occhi naturale
          const blink = Math.sin(t * 3.8) > 0.98 ? 1 : 0;
          ['eyeBlinkLeft', 'eyeBlinkRight'].forEach(name => {
            const idx = mesh.morphTargetDictionary![name];
            if (idx !== undefined) {
              const curBlink = mesh.morphTargetInfluences![idx];
              mesh.morphTargetInfluences![idx] = curBlink + (blink - curBlink) * 0.4;
            }
          });
        }
      }
    });

    // 6. Modifiche Fisiche Procedurali (Scaling Ossa)
    // Forziamo lo scale ad ogni frame per contrastare il reset delle animazioni
    if (bones.leftBreast) bones.leftBreast.scale.set(1.4, 1.4, 1.4);
    if (bones.rightBreast) bones.rightBreast.scale.set(1.4, 1.4, 1.4);

    // Micro-movimenti procedurali testa per dare vita all'idle
    if (bones.head && !isSpeaking && !isRandomDancing) {
      bones.head.rotation.x += Math.sin(t * 0.4) * 0.0003;
      bones.head.rotation.y += Math.cos(t * 0.3) * 0.0003;
    }

    if (group.current) {
        group.current.position.y = Math.sin(t * 1.2) * 0.01 - 1.6;
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

// Precaricamento risorse
useGLTF.preload('https://cdn.statically.io/gh/dynamick/cdn@main/receptionistAI/avatar.glb');
useFBX.preload(ANIMATION_URLS.talking);
useFBX.preload(ANIMATION_URLS.rumba);
useFBX.preload(ANIMATION_URLS.idle);
