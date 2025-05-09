import { generateInputs } from "noir-jwt";
import { InputMap, type CompiledCircuit } from "@noir-lang/noir_js";
// Assuming these are paths to your lazy loading setup
import { initProver, initVerifier } from "./lazy-modules"; // Adjust path if needed
// EphemeralKey type is no longer needed here
// import { EphemeralKey } from "../types"; // Adjust path if needed

export function splitBigIntToLimbs(
  bigInt: bigint,
  limbBitLength: number, // The bit length of each limb (e.g., 120 or 128 for u128)
  numLimbs: number
): bigint[] {
  const chunks: bigint[] = [];
  const mask = (1n << BigInt(limbBitLength)) - 1n;
  for (let i = 0; i < numLimbs; i++) {
    const chunk = (bigInt / (1n << (BigInt(i) * BigInt(limbBitLength)))) & mask;
    chunks.push(chunk);
  }
  return chunks;
}

const MAX_DOMAIN_LENGTH = 64; // Should match your circuit's global constant

// Define a more specific type for Google's JWKs
interface GoogleJsonWebKey extends JsonWebKey {
  kid: string;
}

// Helper function to fetch Google's public keys (JWKS)
async function fetchGooglePublicKeys(): Promise<GoogleJsonWebKey[]> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    throw new Error("Failed to fetch Google public keys (JWKS)");
  }
  const jwks = await response.json();
  return jwks.keys;
}

// Helper function to find the correct key from JWKS based on JWT header's 'kid'
function findKeyInJwks(
  jwtHeader: any,
  keys: GoogleJsonWebKey[]
): GoogleJsonWebKey | undefined {
  const kid = jwtHeader.kid;
  if (!kid) {
    console.warn("JWT header does not contain 'kid'. Cannot select JWK.");
    return undefined;
  }
  return keys.find((key) => key.kid === kid);
}

export const JWTCircuitHelper = {
  version: "0.3.1", // Update as needed
  generateProof: async ({
    idToken,
    jwtPubkey, // This is the specific JWK for the idToken
    oidcNonce, // The nonce string used in OIDC auth, expected in JWT
    domain, // e.g., "gmail.com"
  }: {
    idToken: string;
    jwtPubkey: GoogleJsonWebKey;
    oidcNonce: string;
    domain: string;
  }) => {
    if (!idToken || !jwtPubkey || !oidcNonce || !domain) {
      throw new Error(
        "[JWT Circuit] Proof generation failed: idToken, jwtPubkey, oidcNonce, and domain are required"
      );
    }

    // These are the claims the circuit will try to extract/verify from partial_data.
    // The order might matter for shaPrecomputeTillKeys if you want to optimize.
    // If partial_data starts right before 'nonce', then ["nonce"] might be enough.
    // If it starts before 'email', then ["email", "email_verified", "nonce"] is safer.
    const claimsToVerify = ["nonce", "email_verified", "email"];

    const jwtInputs = await generateInputs({
      jwt: idToken,
      pubkey: jwtPubkey,
      // shaPrecomputeTillKeys tells noir-jwt to hash up to the first key in this list.
      // The remaining data (partial_data) will contain these keys.
      shaPrecomputeTillKeys: claimsToVerify,
      maxSignedDataLength: 640, // Should match circuit's MAX_PARTIAL_DATA_LENGTH
    });

    // Check for undefined critical inputs from jwtInputs
    if (
      jwtInputs.partial_data === undefined ||
      jwtInputs.partial_hash === undefined ||
      jwtInputs.full_data_length === undefined ||
      jwtInputs.base64_decode_offset === undefined ||
      jwtInputs.pubkey_modulus_limbs === undefined ||
      jwtInputs.redc_params_limbs === undefined ||
      jwtInputs.signature_limbs === undefined
    ) {
      throw new Error(
        "[JWT Circuit] Proof generation failed: essential inputs from noir-jwt SDK are undefined."
      );
    }

    const domainUint8Array = new Uint8Array(MAX_DOMAIN_LENGTH);
    domainUint8Array.set(Uint8Array.from(new TextEncoder().encode(domain)));

    // Prepare inputs for the Noir circuit
    // Ensure names and types match the `main` function in your .nr file
    const inputs: InputMap = {
      partial_data: jwtInputs.partial_data,
      partial_hash: jwtInputs.partial_hash,
      full_data_length: jwtInputs.full_data_length,
      base64_decode_offset: jwtInputs.base64_decode_offset,
      jwt_pubkey_modulus_limbs: jwtInputs.pubkey_modulus_limbs,
      jwt_pubkey_redc_params_limbs: jwtInputs.redc_params_limbs,
      jwt_signature_limbs: jwtInputs.signature_limbs,
      domain: {
        // For BoundedVec<u8, MAX_DOMAIN_LENGTH>
        storage: Array.from(domainUint8Array),
        len: domain.length,
      },
      // This is the string nonce from OIDC, circuit's `decimal_string_to_field` will handle conversion.
      // Noir JS expects field inputs as strings.
      expected_nonce_field: oidcNonce,
    };

    console.log(
      "JWT circuit inputs for Noir:",
      JSON.stringify(
        inputs,
        (key, value) => (typeof value === "bigint" ? value.toString() : value) // BigInts for logging
      )
    );

    const { Noir, UltraHonkBackend } = await initProver();
    // Adjust path to your actual circuit.json
    const circuitArtifact = await import(`../assets/jwt/circuit.json`);
    const backend = new UltraHonkBackend(circuitArtifact.bytecode, {
      threads: 8,
    });
    const noir = new Noir(circuitArtifact as CompiledCircuit);

    // Generate witness and prove
    const startTime = performance.now();
    console.log("Executing Noir circuit to generate witness...");
    const { witness } = await noir.execute(inputs as InputMap);
    console.log("Witness generated. Generating proof...");
    const proof = await backend.generateProof(witness);
    const provingTime = performance.now() - startTime;

    console.log(`Proof generated in ${provingTime.toFixed(2)}ms`);

    return proof; // Uint8Array
  },

  verifyProof: async (
    proof: Uint8Array,
    {
      domain,
      jwtPubkeyModulus, // Pass the full modulus as a bigint
      oidcNonce, // The original string nonce used for proof generation
    }: {
      domain: string;
      jwtPubkeyModulus: bigint; // The RSA public key modulus
      oidcNonce: string; // The nonce string (will be converted to Field for public input)
    }
  ) => {
    if (!proof || !domain || !jwtPubkeyModulus || !oidcNonce) {
      throw new Error(
        "[JWT Circuit] Proof verification failed: proof, domain, jwtPubkeyModulus, and oidcNonce are required"
      );
    }

    const { BarretenbergVerifier } = await initVerifier();
    const vkeyArtifact = await import(`../assets/jwt/circuit-vkey.json`);

    let verificationKeyBytes: Uint8Array;
    const vkeyData = vkeyArtifact.default || vkeyArtifact; // Get the actual key data

    if (typeof vkeyData === "string") {
      verificationKeyBytes = new Uint8Array(Buffer.from(vkeyData, "hex"));
    } else if (
      Array.isArray(vkeyData) &&
      vkeyData.every((item) => typeof item === "number")
    ) {
      verificationKeyBytes = new Uint8Array(vkeyData as number[]);
    } else {
      throw new Error(
        "Invalid verification key format in circuit-vkey.json. Expected hex string or array of numbers."
      );
    }

    const publicInputs: string[] = [];

    // 1. jwt_pubkey_modulus_limbs (18 Fields)
    //    Noir u128 limbs are 16 bytes = 32 hex chars. The splitBigIntToLimbs should use a limbBitLength like 128.
    const modulusLimbs = splitBigIntToLimbs(jwtPubkeyModulus, 128, 18);
    publicInputs.push(
      ...modulusLimbs.map((limb) => "0x" + limb.toString(16).padStart(32, "0"))
    );

    // 2. domain (BoundedVec<u8, MAX_DOMAIN_LENGTH>)
    const domainUint8Array = new Uint8Array(MAX_DOMAIN_LENGTH);
    const encodedDomain = new TextEncoder().encode(domain);
    domainUint8Array.set(encodedDomain.slice(0, MAX_DOMAIN_LENGTH));

    publicInputs.push(
      ...Array.from(domainUint8Array).map(
        (byte) => "0x" + byte.toString(16).padStart(2, "0")
      )
    );
    publicInputs.push(
      "0x" +
        Math.min(domain.length, MAX_DOMAIN_LENGTH).toString(16).padStart(2, "0")
    );

    // 3. expected_nonce_field (1 Field)
    try {
      const nonceAsField = BigInt(oidcNonce);
      publicInputs.push("0x" + nonceAsField.toString(16).padStart(64, "0"));
    } catch (e) {
      console.error(
        "Error converting oidcNonce to BigInt for public input:",
        e
      );
      throw new Error(
        "oidcNonce could not be converted to a Field representation for verification."
      );
    }

    console.log("Public inputs for Barretenberg verification:", publicInputs);

    // The BarretenbergVerifier constructor might not need crsPath if it's bundled or handled differently
    // For example, if it uses wasm that has it or if the key itself contains all info.
    // The API for BarretenbergVerifier might have changed. Checking against typical usage.
    const verifier = new BarretenbergVerifier();

    // Verify the actual method name and signature for BarretenbergVerifier
    // This is a common pattern, but might need adjustment based on the exact API of your @noir-lang/noir_js version
    if (typeof (verifier as any).verifyProof !== "function") {
      throw new Error(
        "BarretenbergVerifier does not have a verifyProof method. Check the API."
      );
    }
    // Cast to any to try and call it, assuming the structure is { proof, publicInputs }
    const result = await (verifier as any).verifyProof({ proof, publicInputs });

    return result;
  },

  // Utility to be used by the main generateSenderProof function
  fetchGooglePublicKeyForIdToken: async (
    idToken: string
  ): Promise<GoogleJsonWebKey> => {
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid ID token format");
    }
    let headerPayload: string;
    try {
      // Handle potential base64 URL decoding issues
      headerPayload = parts[0].replace(/-/g, "+").replace(/_/g, "/");
      while (headerPayload.length % 4) {
        headerPayload += "=";
      }
      const header = JSON.parse(atob(headerPayload));
      const googlePublicKeys = await fetchGooglePublicKeys();
      const jwtPubkey = findKeyInJwks(header, googlePublicKeys);
      if (!jwtPubkey) {
        throw new Error("Matching public key not found for the ID token's kid");
      }
      return jwtPubkey;
    } catch (e) {
      console.error("Error decoding JWT header or fetching key:", e);
      throw new Error(
        "Could not decode JWT header or fetch corresponding Google public key."
      );
    }
  },
};

// Placeholder for splitBigIntToLimbs if not already defined elsewhere
// You should have a robust implementation of this based on your bignum strategy in Noir
// This is a simplified conceptual placeholder.
// function splitBigIntToLimbs(value: bigint, limbBitLength: number, numLimbs: number): bigint[] {
//   const limbs: bigint[] = [];
//   const limbMask = (1n << BigInt(limbBitLength)) - 1n;
//   for (let i = 0; i < numLimbs; i++) {
//     limbs.push((value >> (BigInt(i * limbBitLength))) & limbMask);
//   }
//   return limbs;
// }
