
import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Sparkles } from '@react-three/drei';
import { Avatar } from './Avatar';
import Loader from './Loader';
import * as THREE from 'three';

interface SceneProps {
  modelUrl: string;
  isSpeaking: boolean;
  isRumbaCommanded: boolean;
  isJumpCommanded: boolean;
  isAngryCommanded: boolean;
  isGreetingCommanded: boolean;
  isHipHopCommanded: boolean;
  isKissCommanded: boolean;
  isLookAroundCommanded: boolean;
  isPointingCommanded: boolean;
  audioAmplitude: number;
}

const CameraController: React.FC<{ isSpeaking: boolean }> = ({ isSpeaking }) => {
  const controlsRef = useRef<any>(null);
  
  // Inquadratura Mezzo Busto molto ravvicinata
  // Avviciniamo la camera (z: 1.2) e puntiamo leggermente sotto il volto (y: 1.5)
  // per mantenere la testa visibile pur essendo molto vicini.
  const normalPos = new THREE.Vector3(0, 1.6, 1.2); 
  const normalTarget = new THREE.Vector3(0, 1.45, 0); 

  // Inquadratura Primo Piano (Tight Close-up) durante il parlato
  // Portiamo la camera estremamente vicina al volto (z: 0.65)
  // puntando esattamente all'altezza degli occhi (y: 1.65).
  const zoomPos = new THREE.Vector3(0, 1.65, 0.65);
  const zoomTarget = new THREE.Vector3(0, 1.65, 0); 

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const step = 0.05;
    
    // 1. Calcolo target base per Zoom/Normal
    const targetPos = isSpeaking ? zoomPos : normalPos;
    const targetLookAt = isSpeaking ? zoomTarget : normalTarget;
    
    // 2. Transizione fluida (Lerp)
    state.camera.position.lerp(targetPos, step);
    
    // 3. EFFETTO CAMERA SHAKE MINIMIZZATO (Subtle float)
    const shakeFreq = 0.4;
    const shakeAmp = 0.0015; 
    state.camera.position.x += Math.sin(t * shakeFreq) * shakeAmp;
    state.camera.position.y += Math.cos(t * shakeFreq * 0.7) * shakeAmp;
    
    // Rollio ridotto al minimo
    state.camera.rotation.z = Math.sin(t * 0.3) * 0.0003;

    // 4. Aggiornamento Target
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt, step);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      enablePan={false}
      minDistance={0.3}
      maxDistance={2.5}
      minPolarAngle={Math.PI / 4}
      maxPolarAngle={Math.PI / 1.6}
      enableDamping
      dampingFactor={0.05}
    />
  );
};

const MagicSparkles = () => {
  return (
    <group position={[0, 1.4, 0]}>
      {/* Scintille dorate piccole e lente */}
      <Sparkles 
        count={35} 
        scale={[2, 2.5, 2]} 
        size={2} 
        speed={0.2} 
        opacity={0.6} 
        color="#ffd700" 
      />
      {/* Scintille bianche brillanti sporadiche */}
      <Sparkles 
        count={12} 
        scale={[2.5, 3, 2.5]} 
        size={3} 
        speed={0.5} 
        noise={1}
        opacity={0.8} 
        color="#ffffff" 
      />
    </group>
  );
};

const Scene: React.FC<SceneProps> = ({ 
  modelUrl,
  isSpeaking, 
  isRumbaCommanded, 
  isJumpCommanded, 
  isAngryCommanded, 
  isGreetingCommanded, 
  isHipHopCommanded,
  isKissCommanded,
  isLookAroundCommanded,
  isPointingCommanded,
  audioAmplitude 
}) => {
  const floorHeight = 0;

  return (
    <div className="relative w-full h-full">
      <Loader />
      <Canvas camera={{ position: [0, 1.6, 1.5], fov: 45 }} className="w-full h-full" shadows>
        <Suspense fallback={null}>
          <Environment 
            preset="park" 
            background
            ground={{
              height: 10,
              radius: 60,
              scale: 100
            }}
          />
          <ambientLight intensity={0.6} />
          <spotLight 
            position={[2, 4, 3]} 
            angle={0.5} 
            penumbra={1} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          <spotLight position={[-5, 5, 5]} angle={0.5} penumbra={1} intensity={0.5} color="#dbeafe" />

          <group position={[0, floorHeight, 0]}>
            <Avatar 
              key={modelUrl}
              modelUrl={modelUrl}
              isSpeaking={isSpeaking}
              isRumbaCommanded={isRumbaCommanded}
              isJumpCommanded={isJumpCommanded}
              isAngryCommanded={isAngryCommanded}
              isGreetingCommanded={isGreetingCommanded}
              isHipHopCommanded={isHipHopCommanded}
              isKissCommanded={isKissCommanded}
              isLookAroundCommanded={isLookAroundCommanded}
              isPointingCommanded={isPointingCommanded}
              audioAmplitude={audioAmplitude}
            />
          </group>

          {/* Effetto Magico Sparkles */}
          <MagicSparkles />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
            <planeGeometry args={[20, 20]} />
            <shadowMaterial transparent opacity={0.3} />
          </mesh>

          <ContactShadows 
            position={[0, 0.002, 0]} 
            opacity={0.6} 
            scale={10} 
            blur={2.5} 
            far={1.5} 
            resolution={256} 
            color="#000000" 
          />
        </Suspense>
        <CameraController isSpeaking={isSpeaking} />
      </Canvas>
    </div>
  );
};

export default Scene;
