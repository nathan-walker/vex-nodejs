/**
 * The header byte for each encoding type
 */
var ENCODING_V1 = 0x10;
var ENCODING_V1_COMPRESSED = 0x1C;

module.exports = {
	/**
	 * Encodes the vector using the latest version of the encoding system
	 * @param sequence	the int array that represents the numerical vector
	 * @return the raw-byte array for storage
	 */ 
	encode(sequence) {
		
		// A byte array of the maximum possible needed size
		// Calculated assuming that each int is > 1 byte,
		// with an extra header byte
		var worstCase = new Uint8Array(sequence.length * 3 + 1);
		
		// Add the header byte
		worstCase[0] = ENCODING_V1;
		
		// The current index in the output array
		// Starts at 1 because the first byte is the header byte
		var index = 1;
		
		// For each number in the int, sequence:
		// add it to the array and update the most recent index
		for (var i = 0; i < sequence.length; i++) {
			index = this.insertBytesIntoArray(this.numberToBytes(sequence[i]), worstCase, index);
		}
		
		// create a new output array of the actual needed size
		var out = new Uint8Array(index);
		
		// Copy the elements from the worst case array to the actual array
		for (var i = 0; i < out.length; i++) {
			out[i] = worstCase[i];
		}
		
		return out;
	},
	
	/**
	 * Encodes the vector using the latest version of the encoding system, with compression
	 * @param sequence	the int array that represents the numerical vector
	 * @return the raw-byte array for storage
	 */
	encodeCompressed(sequence) {
		
		// A byte array of the maximum possible needed size
		// Calculated assuming that each int is > 1 byte,
		// with an extra header byte
		var worstCase = new Uint8Array(sequence.length * 3 + 1);
		
		// Add the header byte
		worstCase[0] = ENCODING_V1_COMPRESSED;
		
		// The current index in the output array
		// Starts at 1 because the first byte is the header byte
		var index = 1;
		
		// For each int in the sequence:
		for (var i = 0; i < sequence.length; i++) {
			if (sequence[i] === 0) {
				
				// If the int is 0, seek forward to see how many continuous zeros there are
				
				var zeroCount = 0;
				while (i < sequence.length && sequence[i] === 0 && zeroCount < 65535) {
					zeroCount += 1;
					i++;
				}
				
				// Set the index in the int sequence back to the proper position after
				// the while loop
				i--;
				
				// If there are more than two zeros:
				if (zeroCount > 2) {
					
					// Three bytes out:
					var out = new Uint8Array(3);
					
					// First byte: a flag character designating a sequence of zeros
					out[0] = 0xFF;
					
					// Encode the zeroCount to bytes using the standard system
					var zeroCountBytes = this.numberToBytes(zeroCount);
					
					if (zeroCountBytes.length === 1) {
						// If the count is < 254, pad it with a zero
						// Two bytes are expected to denote the number of zeros
						out[1] = 0x00;
						out[2] = zeroCountBytes[0];
					} else if (zeroCountBytes.length === 3) {
						// Copy the bytes directly into the output
						out[1] = zeroCountBytes[1];
						out[2] = zeroCountBytes[2];
					}
					
					// Insert the bytes into the output
					index = this.insertBytesIntoArray(out, worstCase, index);
				} else {
					// If there are only one or two zeros, just insert them
					// It is more space efficient this way
					var out = new Uint8Array(zeroCount);
					
					index = this.insertBytesIntoArray(out, worstCase, index);
				}
				
			} else {
				
				// Insert the number into the byte array, after encoding it properly
				index = this.insertBytesIntoArray(this.numberToBytes(sequence[i]), worstCase, index);
			}
		}
		
		// Create a new byte array of the exact length needed.
		var out = new Uint8Array(index);
		
		// Copy from the worst case into the new array
		for (var i = 0; i < out.length; i++) {
			out[i] = worstCase[i];
		}
		
		return out;
	},

	
	/**
	 * Encodes the integer into a series of bytes
	 * Only supports numbers up to 16-bits unsigned, < 65536
	 *
	 * @param number	the int to be encoded into the byte format
	 * @return a sequence of one or three bytes representing the int
	 */
	numberToBytes(n) {
		var out;
		
		// Checking if the number is larger than 1 byte
		// 254 (0xFE) and 255 (0xFF) are reserved for flag bytes
		if (n > 253) {
			n = this.shortCeiling(n);
			
			// If number requires 16-bit, output three bytes
			out = new Uint8Array(3);
			
			// First byte: flag byte
			out[0] = 0xfe;
			
			// Second byte: high byte of the number
			out[1] = (n >> 8);
			
			// Third byte: low byte of the number
			out[2] = n;
		} else {
			// Just output the byte-sized number, wrapped in an array
			out = new Uint8Array(1);
			out[0] = n;
		}
		
		return out;
	},
	
	/**
	 * Inserts an array of bytes into another array of bytes, starting at a particular index
	 * @param bytes			the array of bytes to be inserted
	 * @param array			the array of bytes into which the bytes will be inserted
	 * @param startIndex	the index to start inserting bytes at
	 * @return the next open index to insert bytes
	 */
	insertBytesIntoArray(bytes, array, startIndex) {
		for (var i = 0; i < bytes.length; i++) {
			array[startIndex] = bytes[i];
			startIndex++;
		}
		
		return startIndex;
	},
	
	/*
	 * Caps all ints passed at 16-bit unsigned limit
	 * @param number	the number to cap
	 * @return the capped int
	 */	
	shortCeiling(n) {
		if (n > 65535) {
			return 65535;
		} else if (n < 0) {
			return 0;
		} else {
			return n;
		}
	},
	
	/*
	 * Decode a byte sequence, while checking the version
	 * @param sequence	the byte sequence to decode
	 * @return a vector represented as an array of ints
	 */
	decode(sequence) {
		if (sequence[0] !== 0x10 && sequence[0] !== 0x1C) {
			throw new Error("VexNotRecognized");
		}
		
		return this.decodeV1(sequence);
	},
	
	/**
	 * Decodes version 1 of the encoding system into an array of ints
	 * @param sequence	the byte array to be decoded
	 * @return the int array representing the vector
	 */
	 decodeV1(sequence) {
		
		// Reject a non-version 1 encoded sequence
		if (sequence[0] !== 0x10 && sequence[0] !== 0x1C) {
			throw new Error("VexNotRecognized");
		}
		
		// Create an array list to hold the output
		var numbers = [];
		
		// For each byte, ignoring the header
		for (var i = 1; i < sequence.length; i++) {
			
			var b = sequence[i];
						
			switch (b) {
				// Two-byte number:
				case 0xFE:
					// Shift into an int
					var num = (sequence[i+1] << 8) | (sequence[i+2]);
					numbers.push(num);
					
					// Increment by two, because two new bytes were read ahead
					i += 2;
					break;
				// Sequence of zeros:
				case 0xFF:
					// Get the two-byte number of zeros 
					var numberOfZeros = (sequence[i+1] << 8) | (sequence[i+2]);
					
					// Increment by two, because two new bytes were read ahead
					i += 2;
					// Add the correct number of zeros to the output
					for (var j = 0; j < numberOfZeros; j++) {
						numbers.push(0);
					}
					break;	
				default:
					numbers.push(b);
			}
		}
		
		return numbers;
		
	}


};